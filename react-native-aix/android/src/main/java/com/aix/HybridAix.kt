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
        updateBlankSizeAndScroll()
        queuedScrollToEnd?.let { queued ->
            if (index == queued.index) {
                flushQueuedScrollToEnd()
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
        val contentContainer = scrollView.getChildAt(0) as? ViewGroup ?: return

        val visibleAreaHeight = scrollView.height - keyboardHeight - composerHeight
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
        // Interpolate additional bottom inset between keyboard-closed and keyboard-open values
        val bottomInsets = additionalContentInsets?.bottom
        val additionalBottomClosed = bottomInsets?.whenKeyboardClosed?.toFloat() ?: 0f
        val additionalBottomOpen = bottomInsets?.whenKeyboardOpen?.toFloat() ?: 0f
        val additionalBottom = additionalBottomClosed + (additionalBottomOpen - additionalBottomClosed) * keyboardProgress
        
        val inset = visibleAreaHeight - blankViewHeight - cellsBeforeBlankViewHeight - additionalBottom
        val blankSize = max(0f, inset)

        val totalInsetBottom = blankSize + keyboardHeight + composerHeight + additionalBottom

        scrollView.setPadding(
            scrollView.paddingLeft,
            scrollView.paddingTop,
            scrollView.paddingRight,
            totalInsetBottom.toInt()
        )
        
        val insets = AixContentInsets(
            top = 0.0,
            left = null,
            bottom = totalInsetBottom.toDouble(),
            right = null
        )
        onWillApplyContentInsets?.invoke(insets)
    }

    private fun scrollToEndInternal(animated: Boolean) {
        val scrollView = findScrollView() ?: return
        val contentContainer = scrollView.getChildAt(0) ?: return
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

        updateBlankSizeAndScroll()

        // Apply stickToKeyboard offset (matching iOS behaviour in
        // HybridAixComposer.swift → applyKeyboardTransform).
        val offset = composerView?.stickToKeyboard?.offset
        val offsetWhenClosed = offset?.whenKeyboardClosed?.toFloat() ?: 0f
        val offsetWhenOpen = offset?.whenKeyboardOpen?.toFloat() ?: 0f
        val currentOffset = offsetWhenClosed + (offsetWhenOpen - offsetWhenClosed) * keyboardProgress

        composerView?.view?.translationY = -(nextKeyboardHeight + currentOffset)
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

                        if (queuedScrollToEnd?.waitForKeyboardToEnd == true) {
                            flushQueuedScrollToEnd(force = true)
                        }
                    }
                }
            }
        )
    }
}
