package com.aix

import android.app.Activity
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowInsets
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.ScrollView
import androidx.annotation.Keep
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.aix.AixAdditionalContentInsetsProp
import com.margelo.nitro.aix.AixScrollIndicatorInsets
import com.margelo.nitro.aix.AixScrollOnFooterSizeUpdate
import com.margelo.nitro.aix.HybridAixSpec
import java.lang.ref.WeakReference

/**
 * HybridAix is the main controller for keyboard-aware chat message lists on Android.
 * It manages keyboard events, scroll positioning, blank size calculation, and content insets.
 *
 * This mirrors the iOS HybridAix.swift implementation.
 */
@Keep
@DoNotStrip
class HybridAix(private val context: ThemedReactContext) : HybridAixSpec(), AixContext {

    companion object {
        private const val TAG = "HybridAix"
    }

    // MARK: - Inner View

    /**
     * Custom ViewGroup that notifies owner when added to parent.
     * Uses FrameLayout to support children from React Native.
     */
    private inner class InnerView(context: android.content.Context) : FrameLayout(context) {
        override fun onAttachedToWindow() {
            super.onAttachedToWindow()
            handleAttachedToWindow()
        }

        override fun onDetachedFromWindow() {
            super.onDetachedFromWindow()
            handleDetachedFromWindow()
        }
    }

    // MARK: - View

    override val view: View = InnerView(context).apply {
        // Make the view not intercept touches - let them pass through to children
        isClickable = false
        isFocusable = false
    }

    // MARK: - Props (from Nitro spec)

    private var _shouldStartAtEnd: Boolean = true
    override var shouldStartAtEnd: Boolean
        get() = _shouldStartAtEnd
        set(value) {
            _shouldStartAtEnd = value
        }

    private var _scrollOnFooterSizeUpdate: AixScrollOnFooterSizeUpdate? = null
    override var scrollOnFooterSizeUpdate: AixScrollOnFooterSizeUpdate?
        get() = _scrollOnFooterSizeUpdate
        set(value) {
            _scrollOnFooterSizeUpdate = value
        }

    private var _scrollEndReachedThreshold: Double? = null
    override var scrollEndReachedThreshold: Double?
        get() = _scrollEndReachedThreshold
        set(value) {
            _scrollEndReachedThreshold = value
        }

    private var _additionalContentInsets: AixAdditionalContentInsetsProp? = null
    override var additionalContentInsets: AixAdditionalContentInsetsProp?
        get() = _additionalContentInsets
        set(value) {
            _additionalContentInsets = value
            applyContentPadding()
        }

    private var _additionalScrollIndicatorInsets: AixScrollIndicatorInsets? = null
    override var additionalScrollIndicatorInsets: AixScrollIndicatorInsets?
        get() = _additionalScrollIndicatorInsets
        set(value) {
            _additionalScrollIndicatorInsets = value
        }

    private var _mainScrollViewID: String? = null
    override var mainScrollViewID: String?
        get() = _mainScrollViewID
        set(value) {
            _mainScrollViewID = value
            // Clear cached scroll view so it's re-found with new ID
            cachedScrollView = null
        }

    private var _penultimateCellIndex: Double? = null
    override var penultimateCellIndex: Double?
        get() = _penultimateCellIndex
        set(value) {
            _penultimateCellIndex = value
        }

    // MARK: - Private State

    /** Current keyboard height */
    private var keyboardHeight: Float = 0f

    /** Keyboard height when fully open (for progress calculation) */
    private var keyboardHeightWhenOpen: Float = 0f

    /** Keyboard animation progress (0 = closed, 1 = open) */
    private var keyboardProgress: Float = 0f

    /** Whether we've performed the initial scroll to end */
    private var didScrollToEndInitially = false

    /** Queued scroll operation waiting for blank view update */
    private var queuedScrollToEnd: QueuedScrollToEnd? = null

    /** Last reported blank view size to avoid duplicate updates */
    private var lastReportedBlankViewSize = BlankViewSizeReport(0f, 0f, 0)

    /** Last reported composer height */
    private var lastReportedComposerHeight: Float = 0f

    /** Cached scroll view reference */
    private var cachedScrollView: WeakReference<View>? = null

    /** Whether keyboard animation is in progress */
    private var isKeyboardAnimating = false

    /** Scroll position at start of keyboard animation */
    private var scrollAtStart: Float = 0f

    /** Whether keyboard is opening (true) or closing (false) */
    private var isKeyboardOpening = false

    /** Target scroll Y for interpolation during keyboard animation */
    private var interpolateScrollTarget: Pair<Float, Float>? = null

    /** Handler for main thread operations */
    private val mainHandler = Handler(Looper.getMainLooper())

    /** Registered cells - maps index to cell */
    private val cells = mutableMapOf<Int, WeakReference<HybridAixCellView>>()

    // MARK: - AixContext Protocol Implementation

    override var blankView: HybridAixCellView? = null

    override var composerView: HybridAixComposer? = null

    override fun reportBlankViewSizeChange(width: Float, height: Float, index: Int) {
        val didAlreadyUpdate = height == lastReportedBlankViewSize.height &&
                width == lastReportedBlankViewSize.width &&
                index == lastReportedBlankViewSize.index

        if (didAlreadyUpdate) return

        lastReportedBlankViewSize = BlankViewSizeReport(width, height, index)
        Log.d(TAG, "reportBlankViewSizeChange: width=$width, height=$height, index=$index")

        if (!didScrollToEndInitially) {
            applyContentPadding()
            scrollToEndInternal(animated = false)
            didScrollToEndInitially = true
        } else {
            applyContentPadding()

            // Check if we have a queued scroll waiting for this index
            queuedScrollToEnd?.let { queued ->
                if (index == queued.index) {
                    flushQueuedScrollToEnd()
                }
            }
        }
    }

    override fun registerCell(cell: HybridAixCellView) {
        cells[cell.index.toInt()] = WeakReference(cell)

        // If this cell is marked as last, update our blank view reference
        if (cell.isLast) {
            blankView = cell
        }
    }

    override fun unregisterCell(cell: HybridAixCellView) {
        cells.remove(cell.index.toInt())

        // If this was our blank view, clear it
        if (blankView === cell) {
            blankView = null
        }
    }

    override fun registerComposerView(composerView: HybridAixComposer) {
        this.composerView = composerView
    }

    override fun unregisterComposerView(composerView: HybridAixComposer) {
        if (this.composerView === composerView) {
            this.composerView = null
        }
    }

    override fun reportComposerHeightChange(height: Float) {
        if (height == lastReportedComposerHeight) return

        val previousHeight = lastReportedComposerHeight
        val isShrinking = height < previousHeight

        lastReportedComposerHeight = height
        Log.d(TAG, "reportComposerHeightChange: height=$height")

        if (!didScrollToEndInitially) return

        val shouldScroll = shouldScrollOnFooterSizeUpdate()
        val animated = scrollOnFooterSizeUpdate?.animated ?: false

        applyContentPadding()

        if (shouldScroll) {
            scrollToEndInternal(animated = animated)
        }
    }

    // MARK: - HybridAixSpec Methods

    override fun scrollToEnd(animated: Boolean?) {
        mainHandler.post {
            scrollToEndInternal(animated ?: true)
        }
    }

    override fun scrollToIndexWhenBlankSizeReady(
        index: Double,
        animated: Boolean?,
        waitForKeyboardToEnd: Boolean?
    ) {
        queuedScrollToEnd = QueuedScrollToEnd(
            index = index.toInt(),
            animated = animated ?: true,
            waitForKeyboardToEnd = waitForKeyboardToEnd ?: false
        )

        mainHandler.post {
            // Clear any in-progress keyboard scroll interpolation
            interpolateScrollTarget = null
            flushQueuedScrollToEnd()
        }
    }

    // MARK: - Private Types

    private data class QueuedScrollToEnd(
        val index: Int,
        val animated: Boolean,
        val waitForKeyboardToEnd: Boolean
    )

    private data class BlankViewSizeReport(
        val width: Float,
        val height: Float,
        val index: Int
    )

    // MARK: - Scroll View Access

    /**
     * Find the scroll view within our view hierarchy.
     * If mainScrollViewID is provided, searches by tag first.
     */
    private val scrollView: View?
        get() {
            cachedScrollView?.get()?.let { return it }

            val searchRoot = view.parent as? View ?: view

            var sv: View? = null

            // If mainScrollViewID is provided, try to find by tag first
            if (!mainScrollViewID.isNullOrEmpty()) {
                sv = AixContextFinder.findScrollViewWithTag(searchRoot, mainScrollViewID!!)
                if (sv != null) {
                    Log.d(TAG, "scrollView found by ID '$mainScrollViewID': $sv")
                }
            }

            // Fallback to default subview iteration if not found by ID
            if (sv == null) {
                sv = AixContextFinder.findFirstScrollView(searchRoot)
                Log.d(TAG, "scrollView found by iteration: $sv")
            }

            sv?.let {
                cachedScrollView = WeakReference(it)
                setupScrollView(it)
            }

            return sv
        }

    /**
     * Set up the scroll view with proper configuration.
     */
    private fun setupScrollView(scrollView: View) {
        if (scrollView is ScrollView) {
            // Disable clip to padding so bottom padding creates scrollable space
            scrollView.clipToPadding = false
        }

        // For RecyclerView, the RN layer handles clipToPadding via props
    }

    // MARK: - Blank Size Calculation

    /**
     * Height of the composer view.
     */
    private val composerHeight: Float
        get() = composerView?.view?.height?.toFloat() ?: 0f

    /**
     * Additional content inset for top, interpolated based on keyboard progress.
     */
    private val additionalContentInsetTop: Float
        get() {
            val insets = additionalContentInsets?.top ?: return 0f
            val whenClosed = insets.whenKeyboardClosed.toFloat()
            val whenOpen = insets.whenKeyboardOpen.toFloat()
            return whenClosed + (whenOpen - whenClosed) * keyboardProgress
        }

    /**
     * Additional content inset for bottom, interpolated based on keyboard progress.
     */
    private val additionalContentInsetBottom: Float
        get() {
            val insets = additionalContentInsets?.bottom ?: return 0f
            val whenClosed = insets.whenKeyboardClosed.toFloat()
            val whenOpen = insets.whenKeyboardOpen.toFloat()
            return maxOf(0f, whenClosed + (whenOpen - whenClosed) * keyboardProgress)
        }

    /**
     * Calculate the blank size - the space needed to push content up
     * so the last message can scroll to the top of the visible area.
     */
    private fun calculateBlankSize(keyboardHeight: Float, additionalBottom: Float): Float {
        val sv = scrollView ?: return 0f
        val blank = blankView ?: return 0f

        val cellBeforeBlankView = getCell(blank.index.toInt() - 1)
        val cellBeforeBlankViewHeight = cellBeforeBlankView?.view?.height?.toFloat() ?: 0f
        val blankViewHeight = blank.view.height.toFloat()

        // Calculate visible area above all bottom chrome
        val visibleAreaHeight = sv.height - keyboardHeight - composerHeight - additionalBottom
        val inset = visibleAreaHeight - blankViewHeight - cellBeforeBlankViewHeight

        return maxOf(0f, inset)
    }

    /**
     * Current blank size using current keyboard state.
     */
    private val blankSize: Float
        get() = calculateBlankSize(keyboardHeight, additionalContentInsetBottom)

    /**
     * Calculate the total content padding for the bottom of the scroll view.
     */
    private fun calculateContentPaddingBottom(
        keyboardHeight: Float,
        blankSize: Float,
        additionalBottom: Float
    ): Float {
        return blankSize + keyboardHeight + composerHeight + additionalBottom
    }

    /**
     * Current content padding bottom.
     */
    private val contentPaddingBottom: Float
        get() = calculateContentPaddingBottom(keyboardHeight, blankSize, additionalContentInsetBottom)

    /**
     * Apply the current content padding to the scroll view.
     * This simulates iOS contentInset using padding with clipToPadding=false.
     */
    private fun applyContentPadding(overrideBottom: Float? = null) {
        val sv = scrollView ?: return

        val targetTop = additionalContentInsetTop.toInt()
        val targetBottom = (overrideBottom ?: contentPaddingBottom).toInt()

        if (sv is ScrollView) {
            val currentTop = sv.paddingTop
            val currentBottom = sv.paddingBottom

            if (currentTop != targetTop || currentBottom != targetBottom) {
                sv.setPadding(sv.paddingLeft, targetTop, sv.paddingRight, targetBottom)
            }
        } else if (sv is ViewGroup) {
            // For RecyclerView or other ViewGroups
            val currentTop = sv.paddingTop
            val currentBottom = sv.paddingBottom

            if (currentTop != targetTop || currentBottom != targetBottom) {
                sv.setPadding(sv.paddingLeft, targetTop, sv.paddingRight, targetBottom)
            }
        }
    }

    // MARK: - Scroll Operations

    /**
     * Internal scroll to end implementation.
     */
    private fun scrollToEndInternal(animated: Boolean) {
        val sv = scrollView ?: return

        // Get the scroll content height
        val contentHeight = getScrollContentHeight(sv)
        val visibleHeight = sv.height
        val bottomPadding = contentPaddingBottom.toInt()

        // Calculate the offset to show the bottom of content
        val targetY = maxOf(0, contentHeight - visibleHeight + bottomPadding)

        Log.d(TAG, "scrollToEndInternal: contentHeight=$contentHeight, visibleHeight=$visibleHeight, bottomPadding=$bottomPadding, targetY=$targetY, animated=$animated")

        if (sv is ScrollView) {
            if (animated) {
                sv.smoothScrollTo(0, targetY)
            } else {
                sv.scrollTo(0, targetY)
            }
        } else {
            // For RecyclerView, use scrollBy or similar
            try {
                val scrollToMethod = sv.javaClass.getMethod("smoothScrollToPosition", Int::class.java)
                // For RecyclerView, we'd typically scroll to the last position
                // But since we're dealing with raw scroll values, use reflection carefully
            } catch (e: Exception) {
                // Fallback: try to scroll using View's scrollTo
                if (animated) {
                    // Android View doesn't have smoothScrollTo, so just scroll
                    sv.scrollTo(0, targetY)
                } else {
                    sv.scrollTo(0, targetY)
                }
            }
        }
    }

    /**
     * Get the content height of a scroll view.
     */
    private fun getScrollContentHeight(scrollView: View): Int {
        return if (scrollView is ScrollView && scrollView.childCount > 0) {
            scrollView.getChildAt(0).height
        } else if (scrollView is ViewGroup && scrollView.childCount > 0) {
            // For RecyclerView, compute scroll range
            try {
                val computeMethod = scrollView.javaClass.getMethod("computeVerticalScrollRange")
                computeMethod.invoke(scrollView) as? Int ?: scrollView.height
            } catch (e: Exception) {
                scrollView.height
            }
        } else {
            scrollView.height
        }
    }

    /**
     * Get the current scroll Y position.
     */
    private fun getScrollY(scrollView: View): Int {
        return if (scrollView is ScrollView) {
            scrollView.scrollY
        } else {
            try {
                val computeMethod = scrollView.javaClass.getMethod("computeVerticalScrollOffset")
                computeMethod.invoke(scrollView) as? Int ?: 0
            } catch (e: Exception) {
                scrollView.scrollY
            }
        }
    }

    /**
     * Check if queued scroll is ready to execute.
     */
    private fun isQueuedScrollToEndReady(queued: QueuedScrollToEnd): Boolean {
        val blank = blankView ?: return false
        if (queued.waitForKeyboardToEnd && isKeyboardAnimating) {
            return false
        }
        return blank.isLast && queued.index == blank.index.toInt()
    }

    /**
     * Execute queued scroll if ready.
     */
    private fun flushQueuedScrollToEnd(force: Boolean = false) {
        val queued = queuedScrollToEnd ?: return
        if (force || isQueuedScrollToEndReady(queued)) {
            scrollToEndInternal(animated = queued.animated)
            queuedScrollToEnd = null
        }
    }

    /**
     * Check if we should scroll when footer size updates.
     */
    private fun shouldScrollOnFooterSizeUpdate(): Boolean {
        val settings = scrollOnFooterSizeUpdate ?: return false
        if (!settings.enabled) return false

        val sv = scrollView ?: return false

        val contentHeight = getScrollContentHeight(sv)
        val scrollViewHeight = sv.height
        val currentOffsetY = getScrollY(sv)
        val bottomPadding = contentPaddingBottom.toInt()

        val maxOffsetY = maxOf(0, contentHeight - scrollViewHeight + bottomPadding)
        val distanceFromEnd = maxOffsetY - currentOffsetY

        val threshold = settings.scrolledToEndThreshold ?: 0.0
        return distanceFromEnd <= threshold
    }

    /**
     * Distance from current scroll position to the end.
     */
    private val distFromEnd: Float
        get() {
            val sv = scrollView ?: return 0f
            val contentHeight = getScrollContentHeight(sv)
            val maxScrollY = contentHeight - sv.height + contentPaddingBottom.toInt()
            return maxScrollY - getScrollY(sv).toFloat()
        }

    /**
     * Check if scrolled near the end.
     */
    private fun isScrolledNearEnd(distFromEnd: Float): Boolean {
        return distFromEnd <= (scrollEndReachedThreshold ?: maxOf(200.0, blankSize.toDouble()))
    }

    /**
     * Get a cell by its index.
     */
    private fun getCell(index: Int): HybridAixCellView? {
        return cells[index]?.get()
    }

    // MARK: - Keyboard Handling

    /**
     * Called when view is attached to window - set up keyboard observer.
     */
    private fun handleAttachedToWindow() {
        Log.d(TAG, "View attached to window")

        // Attach context to parent so children can find it
        (view.parent as? View)?.let { parent ->
            AixContextFinder.setContext(parent, this)
        }
        AixContextFinder.setContext(view, this)

        setupKeyboardObserver()
    }

    /**
     * Called when view is detached from window - clean up.
     */
    private fun handleDetachedFromWindow() {
        Log.d(TAG, "View detached from window")

        (view.parent as? View)?.let { parent ->
            AixContextFinder.setContext(parent, null)
        }
        AixContextFinder.setContext(view, null)

        removeKeyboardObserver()
    }

    /**
     * Set up keyboard observer using WindowInsetsAnimationCompat for smooth animations.
     */
    private fun setupKeyboardObserver() {
        val rootView = view.rootView ?: return

        // Use WindowInsetsAnimationCompat for API 21+ with compat library
        ViewCompat.setWindowInsetsAnimationCallback(
            rootView,
            object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_STOP) {
                override fun onPrepare(animation: WindowInsetsAnimationCompat) {
                    super.onPrepare(animation)
                    if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
                        handleKeyboardWillMove()
                    }
                }

                override fun onStart(
                    animation: WindowInsetsAnimationCompat,
                    bounds: WindowInsetsAnimationCompat.BoundsCompat
                ): WindowInsetsAnimationCompat.BoundsCompat {
                    return bounds
                }

                override fun onProgress(
                    insets: WindowInsetsCompat,
                    runningAnimations: List<WindowInsetsAnimationCompat>
                ): WindowInsetsCompat {
                    val imeAnimation = runningAnimations.find {
                        it.typeMask and WindowInsetsCompat.Type.ime() != 0
                    }

                    if (imeAnimation != null) {
                        val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
                        val imeHeight = imeInsets.bottom.toFloat()
                        val progress = imeAnimation.interpolatedFraction

                        handleKeyboardMove(imeHeight, progress)
                    }

                    return insets
                }

                override fun onEnd(animation: WindowInsetsAnimationCompat) {
                    super.onEnd(animation)
                    if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
                        handleKeyboardDidMove()
                    }
                }
            }
        )

        // Also set up a fallback using OnGlobalLayoutListener for older behavior
        setupFallbackKeyboardObserver(rootView)
    }

    /**
     * Fallback keyboard observer using ViewTreeObserver.
     * This handles cases where WindowInsetsAnimationCompat doesn't work.
     */
    private var globalLayoutListener: ViewTreeObserver.OnGlobalLayoutListener? = null

    private fun setupFallbackKeyboardObserver(rootView: View) {
        globalLayoutListener = ViewTreeObserver.OnGlobalLayoutListener {
            val rect = Rect()
            rootView.getWindowVisibleDisplayFrame(rect)

            val screenHeight = rootView.height
            val keypadHeight = screenHeight - rect.bottom

            // Only use fallback if not already handling via animation callback
            if (!isKeyboardAnimating) {
                val newKeyboardHeight = if (keypadHeight > screenHeight * 0.15) {
                    keypadHeight.toFloat()
                } else {
                    0f
                }

                if (newKeyboardHeight != keyboardHeight) {
                    val wasOpen = keyboardHeight > 0
                    val isNowOpen = newKeyboardHeight > 0

                    if (isNowOpen && newKeyboardHeight > keyboardHeightWhenOpen) {
                        keyboardHeightWhenOpen = newKeyboardHeight
                    }

                    keyboardHeight = newKeyboardHeight
                    keyboardProgress = if (keyboardHeightWhenOpen > 0) {
                        newKeyboardHeight / keyboardHeightWhenOpen
                    } else {
                        0f
                    }

                    applyContentPadding()

                    if (!didScrollToEndInitially && isNowOpen) {
                        scrollToEndInternal(animated = false)
                        didScrollToEndInitially = true
                    }
                }
            }
        }

        rootView.viewTreeObserver.addOnGlobalLayoutListener(globalLayoutListener)
    }

    /**
     * Remove keyboard observers.
     */
    private fun removeKeyboardObserver() {
        view.rootView?.let { rootView ->
            ViewCompat.setWindowInsetsAnimationCallback(rootView, null)

            globalLayoutListener?.let {
                rootView.viewTreeObserver.removeOnGlobalLayoutListener(it)
            }
            globalLayoutListener = null
        }
    }

    /**
     * Handle keyboard will move (start of animation).
     */
    private fun handleKeyboardWillMove() {
        val sv = scrollView ?: return

        isKeyboardAnimating = true
        scrollAtStart = getScrollY(sv).toFloat()

        // Determine if opening or closing based on current state
        // We'll know for sure in onProgress
        Log.d(TAG, "handleKeyboardWillMove: scrollAtStart=$scrollAtStart")
    }

    /**
     * Handle keyboard move during animation.
     */
    private fun handleKeyboardMove(height: Float, progress: Float) {
        // Determine if opening or closing
        val wasOpen = keyboardHeight > 0
        val isOpening = height > keyboardHeight

        if (isOpening && height > keyboardHeightWhenOpen) {
            keyboardHeightWhenOpen = height
        }

        isKeyboardOpening = isOpening || (height > 0 && !wasOpen)

        keyboardHeight = height
        keyboardProgress = if (keyboardHeightWhenOpen > 0) {
            height / keyboardHeightWhenOpen
        } else {
            0f
        }

        applyContentPadding()

        // Interpolate scroll position if needed
        interpolateScrollTarget?.let { (startY, endY) ->
            val normalizedProgress = if (isKeyboardOpening) progress else (1 - progress)
            val newScrollY = startY + (endY - startY) * normalizedProgress

            scrollView?.let { sv ->
                if (sv is ScrollView) {
                    sv.scrollTo(0, newScrollY.toInt())
                }
            }
        }
    }

    /**
     * Handle keyboard animation end.
     */
    private fun handleKeyboardDidMove() {
        isKeyboardAnimating = false
        interpolateScrollTarget = null

        applyContentPadding()

        // Flush queued scroll if waiting for keyboard to end
        if (queuedScrollToEnd?.waitForKeyboardToEnd == true) {
            flushQueuedScrollToEnd(force = true)
        }

        // Reset keyboard height when fully closed
        if (keyboardHeight == 0f) {
            keyboardHeightWhenOpen = 0f
        }

        Log.d(TAG, "handleKeyboardDidMove: keyboardHeight=$keyboardHeight")
    }

    // MARK: - Scroll Position Interpolation

    /**
     * Calculate target scroll position when keyboard is opening.
     */
    private fun getContentOffsetYWhenOpening(scrollY: Float): Pair<Float, Float>? {
        val sv = scrollView ?: return null
        val isScrolledNearEnd = isScrolledNearEnd(distFromEnd)
        val shouldShiftContentUp = blankSize == 0f && isScrolledNearEnd

        val targetAdditionalInset = additionalContentInsets?.bottom?.whenKeyboardOpen?.toFloat() ?: 0f

        val contentHeight = getScrollContentHeight(sv)
        val shiftContentUpToY = contentHeight - sv.height + keyboardHeightWhenOpen + composerHeight + targetAdditionalInset

        if (shouldShiftContentUp) {
            return Pair(scrollY, shiftContentUpToY)
        }

        val hasBlankSizeLessThanOpenKeyboardHeight = blankSize > 0 && blankSize <= keyboardHeightWhenOpen

        if (hasBlankSizeLessThanOpenKeyboardHeight && isScrolledNearEnd) {
            return Pair(scrollY, shiftContentUpToY)
        }

        return null
    }

    /**
     * Calculate target scroll position when keyboard is closing.
     */
    private fun getContentOffsetYWhenClosing(scrollY: Float): Pair<Float, Float>? {
        if (keyboardHeightWhenOpen <= 0) return null

        val isScrolledNearEnd = isScrolledNearEnd(distFromEnd)
        if (!isScrolledNearEnd) return null

        val additionalWithKeyboard = additionalContentInsets?.bottom?.whenKeyboardOpen?.toFloat() ?: 0f
        val additionalWithoutKeyboard = additionalContentInsets?.bottom?.whenKeyboardClosed?.toFloat() ?: 0f

        val blankSizeWithKeyboard = calculateBlankSize(keyboardHeightWhenOpen, additionalWithKeyboard)
        val blankSizeWithoutKeyboard = calculateBlankSize(0f, additionalWithoutKeyboard)

        val insetWithKeyboard = calculateContentPaddingBottom(keyboardHeightWhenOpen, blankSizeWithKeyboard, additionalWithKeyboard)
        val insetWithoutKeyboard = calculateContentPaddingBottom(0f, blankSizeWithoutKeyboard, additionalWithoutKeyboard)
        val insetDecrease = insetWithKeyboard - insetWithoutKeyboard

        val targetScrollY = maxOf(0f, scrollY - insetDecrease)

        if (kotlin.math.abs(scrollY - targetScrollY) <= 1) return null

        return Pair(scrollY, targetScrollY)
    }
}
