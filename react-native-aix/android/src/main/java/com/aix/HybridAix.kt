package com.aix

import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.annotation.Keep
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.scroll.ReactScrollView
import com.facebook.react.views.view.ReactViewGroup
import com.margelo.nitro.aix.*
import kotlin.math.min
import kotlin.math.max

@Keep
@DoNotStrip
class HybridAix(val context: ThemedReactContext): HybridAixSpec(), AixContext {
    
    // Inner view that holds the context tag
    inner class InnerView(context: ThemedReactContext) : ReactViewGroup(context) {
        init {
            setTag(R.id.aix_context, this@HybridAix)
        }

        override fun onAttachedToWindow() {
            super.onAttachedToWindow()

            // Initial snapshot once the view is in the window.
            snapshotViewBottomOffset()
            setupKeyboardInsets()
        }

        override fun onDetachedFromWindow() {
            super.onDetachedFromWindow()
            ViewCompat.setOnApplyWindowInsetsListener(this, null)
            ViewCompat.setWindowInsetsAnimationCallback(this, null)
            detachScrollViewListeners()
            cachedScrollView = null
        }
    }

    override val view: View = InnerView(context)

    // AixContext Implementation
    override var blankView: HybridAixCellView? = null
    override var composerView: HybridAixComposer? = null
    
    override var keyboardHeight: Float = 0f
    override var keyboardHeightWhenOpen: Float = 0f
    private var keyboardProgress: Float = 0f

    private var composerHeight: Float = 0f
    private val cells = mutableMapOf<Int, HybridAixCellView>()
    private var cachedScrollView: ReactScrollView? = null
    private var isImeAnimationRunning: Boolean = false
    private var runningImeAnimationsCount: Int = 0

    /**
     * Distance from the Aix view's bottom edge to the window bottom (e.g. the
     * height of a native tab bar sitting below the view).  Snapshotted once in
     * `onPrepare` before the keyboard animation starts so that `adjustResize`
     * layout changes don't corrupt the value mid-animation.
     */
    private var cachedViewBottomOffset: Float = 0f
    private val locationBuffer = IntArray(2)

    /**
     * Tracks whether we've performed the initial scroll-to-end.
     * Mirrors iOS `didScrollToEndInitiallyForId` — keyed by mainScrollViewID
     * so it resets if the scroll view identity changes.
     */
    private var didScrollToEndInitiallyForId: String? = null
    private val didScrollToEndInitially: Boolean
        get() = didScrollToEndInitiallyForId == (mainScrollViewID ?: "")

    /**
     * Set when `reportBlankViewSizeChange` fires during a keyboard animation.
     * The actual initial scroll is deferred until the animation ends so that
     * the scroll offset is computed with the final keyboard-adjusted padding.
     */
    private var blankViewHasReported: Boolean = false

    // Props
    override var shouldStartAtEnd: Boolean = true
    override var scrollOnFooterSizeUpdate: AixScrollOnFooterSizeUpdate? = null
    override var scrollEndReachedThreshold: Double? = null
    override var additionalContentInsets: AixAdditionalContentInsetsProp? = null
    override var additionalScrollIndicatorInsets: AixScrollIndicatorInsets? = null
    override var mainScrollViewID: String? = null
    override var penultimateCellIndex: Double? = null
    override var shouldApplyContentInsets: Boolean? = null
    override var applyContentInsetDelay: Double? = null
    override var onWillApplyContentInsets: ((insets: AixContentInsets) -> Unit)? = null
    override var onScrolledNearEndChange: ((isNearEnd: Boolean) -> Unit)? = null

    // KVO / Layout listeners
    private val layoutListener = ViewTreeObserver.OnGlobalLayoutListener {
        updateBlankSizeAndScroll()
    }

    private val scrollListener = ViewTreeObserver.OnScrollChangedListener {
        updateScrolledNearEndState()
    }

    // Methods
    override fun scrollToEnd(animated: Boolean?) {

        view.post {
            scrollToEndInternal(animated ?: true)
        }
    }

    data class QueuedScrollToEnd(
        val index: Int,
        val animated: Boolean,
        val waitForKeyboardToEnd: Boolean
    )
    private var queuedScrollToEnd: QueuedScrollToEnd? = null

    private fun isQueuedScrollToEndReady(queued: QueuedScrollToEnd): Boolean {
        val blank = blankView ?: return false
        val isReady = blank.isLast && queued.index == blank.index.toInt() && blank.view.height > 0
        return isReady
    }

    private fun flushQueuedScrollToEnd(force: Boolean = false) {
        val queued = queuedScrollToEnd ?: return
        if (force || isQueuedScrollToEndReady(queued)) {
            queuedScrollToEnd = null
            view.post {
                scrollToEndInternal(queued.animated)
            }
        }
    }

    override fun scrollToIndexWhenBlankSizeReady(index: Double, animated: Boolean?, waitForKeyboardToEnd: Boolean?) {
        queuedScrollToEnd = QueuedScrollToEnd(index.toInt(), animated ?: true, waitForKeyboardToEnd ?: false)
        view.post {
            flushQueuedScrollToEnd()
        }
    }

    override fun reportBlankViewSizeChange(height: Float, index: Int) {
        if (!didScrollToEndInitially) {
            // First blank-view report: apply insets and scroll to end.
            // If a keyboard animation is in flight or about to start, the
            // scroll position may be wrong.  We set a flag so that each
            // subsequent updateBlankSizeAndScroll (triggered by keyboard
            // progress) re-scrolls until the keyboard settles.
            blankViewHasReported = true
            updateBlankSizeAndScroll()
            scrollToEndInternal(animated = false)
            updateScrolledNearEndState()
            didScrollToEndInitiallyForId = mainScrollViewID ?: ""

            // Clear the re-scroll flag after a short delay.  If a keyboard
            // animation is in flight, onEnd will clear it first; otherwise
            // this ensures we stop re-scrolling once the initial layout is done.
            view.postDelayed({ blankViewHasReported = false }, 500)
        } else {
            updateBlankSizeAndScroll()
            queuedScrollToEnd?.let { queued ->
                if (index == queued.index) {
                    flushQueuedScrollToEnd()
                }
            }
        }
    }

    override fun registerCell(cell: HybridAixCellView) {
        cells[cell.index.toInt()] = cell
        if (cell.isLast) {
            blankView = cell
            updateBlankSizeAndScroll()
            flushQueuedScrollToEnd()
        }
    }

    override fun unregisterCell(cell: HybridAixCellView) {
        cells.remove(cell.index.toInt())
        if (blankView === cell) {
            blankView = null
        }
    }

    override fun registerComposerView(composerView: HybridAixComposer) {
        this.composerView = composerView
        updateBlankSizeAndScroll()
    }

    override fun unregisterComposerView(composerView: HybridAixComposer) {
        if (this.composerView === composerView) {
            this.composerView = null
        }
    }

    override fun reportComposerHeightChange(height: Float) {
        if (composerHeight == height) return
        composerHeight = height

        // Before the initial scroll-to-end, just record the height and let
        // reportBlankViewSizeChange handle the first layout pass (mirrors iOS).
        if (!didScrollToEndInitially) return

        updateBlankSizeAndScroll()
    }

    // --- Core Logic ---

    private fun findScrollView(): ReactScrollView? {
        if (cachedScrollView != null) return cachedScrollView
        val root = view.parent as? ViewGroup ?: view as ViewGroup
        cachedScrollView = findScrollViewRecursive(root)
        
        cachedScrollView?.let { sv ->
            sv.viewTreeObserver.addOnGlobalLayoutListener(layoutListener)
            sv.viewTreeObserver.addOnScrollChangedListener(scrollListener)
            sv.clipToPadding = false // Important for paddingBottom approach
        }
        return cachedScrollView
    }

    private fun detachScrollViewListeners() {
        cachedScrollView?.viewTreeObserver?.let { observer ->
            if (observer.isAlive) {
                observer.removeOnGlobalLayoutListener(layoutListener)
                observer.removeOnScrollChangedListener(scrollListener)
            }
        }
    }

    private fun findScrollViewRecursive(v: View): ReactScrollView? {
        if (v is ReactScrollView) {
            val id = mainScrollViewID
            val nativeId = v.getTag(com.facebook.react.R.id.view_tag_native_id)?.toString()
            val testId = v.getTag(com.facebook.react.R.id.react_test_id)?.toString()
            
            if (id == null || 
                v.contentDescription?.toString() == id || 
                nativeId == id || 
                testId == id ||
                v.tag?.toString() == id) {
                return v
            }
        }
        if (v is ViewGroup) {
            for (i in 0 until v.childCount) {
                val found = findScrollViewRecursive(v.getChildAt(i))
                if (found != null) return found
            }
        }
        return null
    }

    private fun updateBlankSizeAndScroll() {
        val scrollView = findScrollView() ?: return

        var cellsBeforeBlankViewHeight = 0f

        val startIndex = penultimateCellIndex?.toInt() ?: ((blankView?.index?.toInt() ?: 1) - 1)
        val endIndex = (blankView?.index?.toInt() ?: 0) - 1

        if (startIndex <= endIndex) {
            for (i in startIndex..endIndex) {
                cells[i]?.let { cell ->
                    cellsBeforeBlankViewHeight += cell.view.height
                }
            }
        }

        val blankViewHeight = blankView?.view?.height?.toFloat() ?: 0f

        // Interpolate additional bottom inset (mirrors iOS additionalContentInsetBottom).
        // Clamped to >= 0, matching the max(0, ...) on iOS.
        val bottomInsets = additionalContentInsets?.bottom
        val additionalBottomClosed = bottomInsets?.whenKeyboardClosed?.toFloat() ?: 0f
        val additionalBottomOpen = bottomInsets?.whenKeyboardOpen?.toFloat() ?: 0f
        val additionalBottom = max(0f, additionalBottomClosed + (additionalBottomOpen - additionalBottomClosed) * keyboardProgress)

        // Interpolate additional top inset (mirrors iOS additionalContentInsetTop).
        // No clamp — top can legitimately be negative, matching iOS behaviour.
        val topInsets = additionalContentInsets?.top
        val additionalTopClosed = topInsets?.whenKeyboardClosed?.toFloat() ?: 0f
        val additionalTopOpen = topInsets?.whenKeyboardOpen?.toFloat() ?: 0f
        val additionalTop = additionalTopClosed + (additionalTopOpen - additionalTopClosed) * keyboardProgress

        val visibleAreaHeight = scrollView.height - keyboardHeight - composerHeight - additionalBottom
        val inset = visibleAreaHeight - blankViewHeight - cellsBeforeBlankViewHeight
        val blankSize = max(0f, inset)

        val totalInsetBottom = blankSize + keyboardHeight + composerHeight + additionalBottom

        // Fire the callback before (potentially) applying, matching iOS applyContentInset order.
        val insets = AixContentInsets(
            top = additionalTop.toDouble(),
            left = null,
            bottom = totalInsetBottom.toDouble(),
            right = null
        )
        onWillApplyContentInsets?.invoke(insets)

        // If shouldApplyContentInsets is explicitly false, skip the actual padding update,
        // matching iOS behaviour where the callback fires but contentInset is not mutated.
        if (shouldApplyContentInsets == false) return

        val contentContainer = scrollView.getChildAt(0)
        val applyInsets = {
            // Top inset: translate the content container down to create empty space
            // above the first message.  This mirrors React Native's own approach in
            // ReactScrollView.setScrollAwayTopPaddingEnabledUnstable — Android's
            // ScrollView doesn't support negative scroll offsets (unlike iOS
            // contentInset.top), and Yoga positions the content container at (0,0)
            // regardless of the parent ScrollView's paddingTop, so translationY on
            // the content container + extra paddingBottom is the correct pattern.
            val newTranslationY = additionalTop
            if (contentContainer != null && contentContainer.translationY != newTranslationY) {
                contentContainer.translationY = newTranslationY
            }

            // Bottom padding includes the top-inset offset so the scroll range
            // accommodates the translated content.  ReactScrollView.getMaxScrollY()
            // uses (contentHeight - (height - paddingBottom - paddingTop)), so the
            // extra additionalTop in paddingBottom extends the scroll range to match
            // the visual content shift.
            val newPaddingBottom = (totalInsetBottom + additionalTop).toInt()
            if (scrollView.paddingBottom != newPaddingBottom) {
                scrollView.setPadding(
                    scrollView.paddingLeft,
                    0,
                    scrollView.paddingRight,
                    newPaddingBottom
                )
            }
        }

        // Apply with optional delay, matching iOS applyContentInsetDelay behaviour.
        val delay = applyContentInsetDelay
        if (delay != null && delay > 0) {
            scrollView.postDelayed(applyInsets, delay.toLong())
        } else {
            applyInsets()
        }
    }

    private fun scrollToEndInternal(animated: Boolean) {
        val scrollView = findScrollView() ?: return
        val contentContainer = scrollView.getChildAt(0) ?: return
        // Max scroll offset: the content container's layout height (translationY
        // is visual-only and does not affect layout height) plus paddingBottom
        // (which already includes additionalTop to compensate for translationY)
        // minus the scroll view's own height.
        val bottomOffset = max(0, contentContainer.height - scrollView.height + scrollView.paddingBottom)
        if (animated) {
            scrollView.smoothScrollTo(0, bottomOffset)
        } else {
            scrollView.scrollTo(0, bottomOffset)
        }
    }

    private fun updateScrolledNearEndState() {
        val scrollView = findScrollView() ?: return
        val contentContainer = scrollView.getChildAt(0) ?: return
        val maxScrollY = contentContainer.height - scrollView.height + scrollView.paddingBottom
        val distFromEnd = maxScrollY - scrollView.scrollY
        val threshold = scrollEndReachedThreshold ?: 200.0
        val isNearEnd = distFromEnd <= threshold
        onScrolledNearEndChange?.invoke(isNearEnd)
    }

    /**
     * Calculate how far the Aix view's bottom edge is from the window bottom.
     * This accounts for any chrome below the view (e.g. a native tab bar).
     * Reuses [locationBuffer] to avoid per-call allocation.
     */
    private fun measureViewBottomOffset(): Float {
        view.getLocationInWindow(locationBuffer)
        val viewBottom = locationBuffer[1] + view.height
        val windowHeight = view.rootView.height
        return max(0f, (windowHeight - viewBottom).toFloat())
    }

    /** Refresh the cached offset — called before keyboard animations and on layout. */
    private fun snapshotViewBottomOffset() {
        cachedViewBottomOffset = measureViewBottomOffset()
    }

    private fun applyKeyboardFrame(imeHeight: Float, imeVisible: Boolean) {
        // IME height from WindowInsetsCompat is relative to the window bottom.
        // When the Aix view is not at the window bottom (e.g. native tab bar
        // sits below it), we must subtract that offset so the composer lands
        // flush against the keyboard instead of leaving a gap.
        // We use a cached value snapshotted *before* the animation to avoid
        // adjustResize layout changes corrupting the measurement mid-animation.
        val adjustedImeHeight = max(0f, imeHeight - cachedViewBottomOffset)

        val nextKeyboardHeight = if (imeVisible) adjustedImeHeight else 0f
        keyboardHeight = nextKeyboardHeight

        if (imeVisible && adjustedImeHeight > keyboardHeightWhenOpen) {
            keyboardHeightWhenOpen = adjustedImeHeight
        }

        if (!imeVisible && !isImeAnimationRunning) {
            keyboardHeightWhenOpen = 0f
        }

        keyboardProgress = if (keyboardHeightWhenOpen > 0f) {
            min(1f, nextKeyboardHeight / keyboardHeightWhenOpen)
        } else {
            0f
        }

        // Before the initial scroll-to-end, just record the keyboard state and
        // apply insets/composer without the full keyboard animation logic.
        // Mirrors iOS handleKeyboardDidShow gating on didScrollToEndInitially.
        if (!didScrollToEndInitially) {
            updateBlankSizeAndScroll()
            composerView?.view?.translationY = -(nextKeyboardHeight + computeComposerOffset())
            return
        }

        updateBlankSizeAndScroll()

        // If the initial scroll just happened but the keyboard is still
        // animating, keep the scroll position pinned to the end so the
        // user sees the last message once the keyboard settles.
        if (blankViewHasReported) {
            scrollToEndInternal(animated = false)
        }

        composerView?.view?.translationY = -(nextKeyboardHeight + computeComposerOffset())
    }

    /** Compute the interpolated stickToKeyboard offset for the composer. */
    private fun computeComposerOffset(): Float {
        val offset = composerView?.stickToKeyboard?.offset
        val offsetWhenClosed = offset?.whenKeyboardClosed?.toFloat() ?: 0f
        val offsetWhenOpen = offset?.whenKeyboardOpen?.toFloat() ?: 0f
        return offsetWhenClosed + (offsetWhenOpen - offsetWhenClosed) * keyboardProgress
    }

    private fun setupKeyboardInsets() {
        val imeType = WindowInsetsCompat.Type.ime()

        ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
            if (!isImeAnimationRunning) {
                // No animation running — safe to re-measure the view position.
                snapshotViewBottomOffset()
                val imeHeight = insets.getInsets(imeType).bottom.toFloat()
                val imeVisible = insets.isVisible(imeType) && imeHeight > 0f
                applyKeyboardFrame(imeHeight, imeVisible)
            }

            insets
        }

        ViewCompat.setWindowInsetsAnimationCallback(
            view,
            object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                override fun onPrepare(animation: WindowInsetsAnimationCompat) {
                    super.onPrepare(animation)
                    if ((animation.typeMask and imeType) == 0) return
                    // Snapshot the view's position before the system applies
                    // adjustResize layout changes, so measurements stay stable
                    // for the duration of the animation.
                    snapshotViewBottomOffset()
                    runningImeAnimationsCount += 1
                    isImeAnimationRunning = true
                }

                override fun onProgress(
                    insets: WindowInsetsCompat,
                    runningAnimations: MutableList<WindowInsetsAnimationCompat>
                ): WindowInsetsCompat {
                    val hasImeAnimation = runningAnimations.any { animation ->
                        (animation.typeMask and imeType) != 0
                    }
                    if (!hasImeAnimation) {
                        return insets
                    }

                    val imeHeight = insets.getInsets(imeType).bottom.toFloat()
                    val imeVisible = insets.isVisible(imeType) || imeHeight > 0f

                    applyKeyboardFrame(imeHeight, imeVisible)

                    return insets
                }

                override fun onEnd(animation: WindowInsetsAnimationCompat) {
                    super.onEnd(animation)
                    if ((animation.typeMask and imeType) == 0) return

                    runningImeAnimationsCount = max(0, runningImeAnimationsCount - 1)
                    if (runningImeAnimationsCount == 0) {
                        isImeAnimationRunning = false

                        // Re-snapshot now that adjustResize has settled.
                        snapshotViewBottomOffset()

                        val rootInsets = ViewCompat.getRootWindowInsets(view)
                        val imeHeight = rootInsets?.getInsets(imeType)?.bottom?.toFloat() ?: 0f
                        val imeVisible = (rootInsets?.isVisible(imeType) == true) && imeHeight > 0f
                        applyKeyboardFrame(imeHeight, imeVisible)

                        // Flush deferred initial scroll now that keyboard has settled
                        // and paddingBottom reflects the final keyboard height.
                        if (blankViewHasReported) {
                            blankViewHasReported = false
                            if (didScrollToEndInitially) {
                                scrollToEndInternal(animated = false)
                                updateScrolledNearEndState()
                            }
                        }

                        if (queuedScrollToEnd?.waitForKeyboardToEnd == true) {
                            flushQueuedScrollToEnd(force = true)
                        }
                    }
                }
            }
        )
    }
}
