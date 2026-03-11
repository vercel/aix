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
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

@Keep
@DoNotStrip
class HybridAix(val context: ThemedReactContext) : HybridAixSpec(), AixContext {

    inner class InnerView(context: ThemedReactContext) : ReactViewGroup(context) {
        init {
            setTag(R.id.aix_context, this@HybridAix)
        }

        override fun onAttachedToWindow() {
            super.onAttachedToWindow()
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
    private var cachedViewBottomOffset: Float = 0f
    private val locationBuffer = IntArray(2)
    private var didScrollToEndInitially: Boolean = false
    private var lastCalculatedBlankSize: Float = 0f
    private var pendingAnimatedScroll: Boolean = false
    private var prevIsScrolledNearEnd: Boolean? = null
    private var lastReportedBlankViewHeight: Float = -1f
    private var lastReportedBlankViewIndex: Int = -1
    private var scrollCompletionView: ReactScrollView? = null
    private var scrollCompletionListener: ViewTreeObserver.OnScrollChangedListener? = null
    private var scrollCompletionFallback: Runnable? = null

    override var shouldStartAtEnd: Boolean = true
    override var scrollOnFooterSizeUpdate: AixScrollOnFooterSizeUpdate? = null
    override var scrollEndReachedThreshold: Double? = null
    override var additionalContentInsets: AixAdditionalContentInsetsProp? = null
    override var additionalScrollIndicatorInsets: AixScrollIndicatorInsets? = null
    override var mainScrollViewID: String? = null
        set(value) {
            if (field == value) return
            field = value
            detachScrollViewListeners()
            cachedScrollView = null
            didScrollToEndInitially = false
            prevIsScrolledNearEnd = null
            blankView = null
            cells.clear()
            lastReportedBlankViewHeight = -1f
            lastReportedBlankViewIndex = -1
            lastCalculatedBlankSize = 0f
            pendingAnimatedScroll = false
        }
    override var penultimateCellIndex: Double? = null
    override var shouldApplyContentInsets: Boolean? = null
    override var applyContentInsetDelay: Double? = null
    override var onWillApplyContentInsets: ((insets: AixContentInsets) -> Unit)? = null
    override var onScrolledNearEndChange: ((isNearEnd: Boolean) -> Unit)? = null
    override var scrollToIndex: Double? = null
        set(value) {
            field = value
            val target = scrollToIndexTarget ?: return
            view.post {
                if (blankView?.index?.toInt() == target) {
                    performScrollToIndex()
                }
            }
        }
    override var onDidScrollToIndex: (() -> Unit)? = null

    private val scrollToIndexTarget: Int?
        get() {
            val idx = scrollToIndex?.toInt() ?: return null
            return if (idx >= 0) idx else null
        }

    private val layoutListener = ViewTreeObserver.OnGlobalLayoutListener {
        if (!didScrollToEndInitially) {
            tryCompleteInitialLayout()
        } else if (scrollToIndexTarget == null) {
            applyAllInsets()
        }
    }

    private val scrollListener = ViewTreeObserver.OnScrollChangedListener {
        updateScrolledNearEndState()
    }

    private val distFromEnd: Double
        get() {
            val scrollView = findScrollView() ?: return 0.0
            val contentContainer = scrollView.getChildAt(0) ?: return 0.0
            val maxScrollY = contentContainer.height - scrollView.height + scrollView.paddingBottom
            return (maxScrollY - scrollView.scrollY).toDouble()
        }

    override fun scrollToEnd(animated: Boolean?) {
        view.post {
            scrollToEndInternal(animated ?: true)
        }
    }

    override fun reportBlankViewSizeChange(height: Float, index: Int) {
        if (lastReportedBlankViewHeight == height && lastReportedBlankViewIndex == index) {
            return
        }

        lastReportedBlankViewHeight = height
        lastReportedBlankViewIndex = index

        if (!didScrollToEndInitially) {
            tryCompleteInitialLayout()
            return
        }

        if (scrollToIndexTarget == index) {
            performScrollToIndex()
            return
        }

        if (scrollToIndexTarget != null) {
            return
        }

        applyAllInsets()
    }

    override fun reportCellHeightChange(index: Int, height: Float) {
        if (!didScrollToEndInitially) return
        if (scrollToIndexTarget != null) return
        applyAllInsets()
    }

    override fun registerCell(cell: HybridAixCellView) {
        cells[cell.index.toInt()] = cell

        if (cell.isLast) {
            blankView = cell

            if (scrollToIndexTarget == cell.index.toInt()) {
                performScrollToIndex()
                return
            }

            reportBlankViewSizeChange(cell.view.height.toFloat(), cell.index.toInt())
        } else if (!didScrollToEndInitially) {
            tryCompleteInitialLayout()
        } else {
            val target = scrollToIndexTarget
            if (target != null && blankView?.index?.toInt() == target) {
                performScrollToIndex()
            } else if (target == null) {
                applyAllInsets()
            }
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
        if (didScrollToEndInitially) {
            applyAllInsets()
        }
    }

    override fun unregisterComposerView(composerView: HybridAixComposer) {
        if (this.composerView === composerView) {
            this.composerView = null
        }
    }

    override fun reportComposerHeightChange(height: Float) {
        if (composerHeight == height) return
        composerHeight = height
        if (!didScrollToEndInitially) return

        val shouldScroll = shouldScrollOnFooterSizeUpdate()
        applyAllInsets()

        if (shouldScroll) {
            scrollToEndInternal(scrollOnFooterSizeUpdate?.animated ?: false)
        }
    }

    private fun findScrollView(): ReactScrollView? {
        cachedScrollView?.let { return it }

        val root = view.parent as? ViewGroup ?: view as ViewGroup
        cachedScrollView = findScrollViewRecursive(root)

        cachedScrollView?.let { scrollView ->
            scrollView.viewTreeObserver.addOnGlobalLayoutListener(layoutListener)
            scrollView.viewTreeObserver.addOnScrollChangedListener(scrollListener)
            scrollView.clipToPadding = false
        }

        return cachedScrollView
    }

    private fun detachScrollViewListeners() {
        clearPendingAnimatedScrollCompletion()
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

            if (
                id == null ||
                v.contentDescription?.toString() == id ||
                nativeId == id ||
                testId == id ||
                v.tag?.toString() == id
            ) {
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

    private fun tryCompleteInitialLayout() {
        if (didScrollToEndInitially) return

        val blank = blankView ?: return
        val blankIndex = blank.index.toInt()
        if (cells[blankIndex] == null) return

        for (i in 0 until blankIndex) {
            if (cells[i] == null) {
                return
            }
        }

        applyAllInsets()
        if (shouldStartAtEnd) {
            scrollToEndInternal(animated = false)
        }

        prevIsScrolledNearEnd = getIsScrolledNearEnd(distFromEnd)
        didScrollToEndInitially = true
    }

    private fun performScrollToIndex() {
        applyAllInsets()

        if (isImeAnimationRunning) {
            pendingAnimatedScroll = true
        } else {
            scrollToEndInternal(animated = true) {
                onDidScrollToIndex?.invoke()
            }
        }
    }

    private fun applyAllInsets() {
        updateBlankSizeAndScroll()
    }

    private fun computeAdditionalBottom(): Float {
        val bottomInsets = additionalContentInsets?.bottom
        val closed = bottomInsets?.whenKeyboardClosed?.toFloat() ?: 0f
        val open = bottomInsets?.whenKeyboardOpen?.toFloat() ?: 0f
        return max(0f, closed + (open - closed) * keyboardProgress)
    }

    private fun computeAdditionalTop(): Float {
        val topInsets = additionalContentInsets?.top
        val closed = topInsets?.whenKeyboardClosed?.toFloat() ?: 0f
        val open = topInsets?.whenKeyboardOpen?.toFloat() ?: 0f
        return closed + (open - closed) * keyboardProgress
    }

    private fun calculateBlankSize(scrollView: ReactScrollView, additionalBottom: Float): Float {
        val blank = blankView ?: return lastCalculatedBlankSize
        val startIndex = penultimateCellIndex?.toInt() ?: (blank.index.toInt() - 1)
        val endIndex = blank.index.toInt() - 1

        var cellsBeforeBlankViewHeight = 0f
        if (startIndex <= endIndex) {
            for (i in startIndex..endIndex) {
                val cell = cells[i] ?: return lastCalculatedBlankSize
                cellsBeforeBlankViewHeight += cell.view.height.toFloat()
            }
        }

        val blankViewHeight = blank.view.height.toFloat()
        val visibleAreaHeight = scrollView.height - keyboardHeight - composerHeight - additionalBottom
        val blankSize = visibleAreaHeight - blankViewHeight - cellsBeforeBlankViewHeight
        lastCalculatedBlankSize = blankSize
        return blankSize
    }

    private fun updateBlankSizeAndScroll() {
        val scrollView = findScrollView() ?: return
        val additionalBottom = computeAdditionalBottom()
        val additionalTop = computeAdditionalTop()
        val blankSize = calculateBlankSize(scrollView, additionalBottom)
        val totalInsetBottom = max(0f, blankSize) + keyboardHeight + composerHeight + additionalBottom

        onWillApplyContentInsets?.invoke(
            AixContentInsets(
                top = additionalTop.toDouble(),
                left = null,
                bottom = totalInsetBottom.toDouble(),
                right = null,
            ),
        )

        if (shouldApplyContentInsets == false) {
            updateScrolledNearEndState()
            return
        }

        val contentContainer = scrollView.getChildAt(0)
        val applyInsets = {
            if (contentContainer != null && contentContainer.translationY != additionalTop) {
                contentContainer.translationY = additionalTop
            }

            val newPaddingBottom = (totalInsetBottom + additionalTop).toInt()
            if (scrollView.paddingBottom != newPaddingBottom) {
                scrollView.setPadding(
                    scrollView.paddingLeft,
                    0,
                    scrollView.paddingRight,
                    newPaddingBottom,
                )
            }

            updateScrolledNearEndState()
        }

        val delay = applyContentInsetDelay
        if (delay != null && delay > 0) {
            scrollView.postDelayed(applyInsets, delay.toLong())
        } else {
            applyInsets()
        }
    }

    private fun scrollToEndInternal(animated: Boolean, onComplete: (() -> Unit)? = null) {
        val scrollView = findScrollView() ?: return
        val contentContainer = scrollView.getChildAt(0) ?: return
        val bottomOffset = max(0, contentContainer.height - scrollView.height + scrollView.paddingBottom)

        clearPendingAnimatedScrollCompletion()

        if (!animated) {
            scrollView.scrollTo(0, bottomOffset)
            onComplete?.invoke()
            return
        }

        if (scrollView.scrollY == bottomOffset) {
            onComplete?.invoke()
            return
        }

        if (onComplete != null) {
            awaitAnimatedScrollCompletion(scrollView, bottomOffset, onComplete)
        }

        scrollView.smoothScrollTo(0, bottomOffset)
    }

    private fun awaitAnimatedScrollCompletion(
        scrollView: ReactScrollView,
        targetY: Int,
        onComplete: () -> Unit,
    ) {
        val listener = ViewTreeObserver.OnScrollChangedListener {
            if (abs(scrollView.scrollY - targetY) <= 1) {
                clearPendingAnimatedScrollCompletion()
                onComplete()
            }
        }

        scrollCompletionView = scrollView
        scrollCompletionListener = listener
        scrollView.viewTreeObserver.addOnScrollChangedListener(listener)

        val fallback = Runnable {
            if (scrollCompletionListener === listener) {
                clearPendingAnimatedScrollCompletion()
                onComplete()
            }
        }

        scrollCompletionFallback = fallback
        view.postDelayed(fallback, 500)
    }

    private fun clearPendingAnimatedScrollCompletion() {
        scrollCompletionView?.viewTreeObserver?.let { observer ->
            val listener = scrollCompletionListener
            if (listener != null && observer.isAlive) {
                observer.removeOnScrollChangedListener(listener)
            }
        }

        scrollCompletionFallback?.let { view.removeCallbacks(it) }
        scrollCompletionView = null
        scrollCompletionListener = null
        scrollCompletionFallback = null
    }

    private fun getIsScrolledNearEnd(distFromEnd: Double): Boolean {
        val threshold = scrollEndReachedThreshold ?: max(200.0, max(0f, lastCalculatedBlankSize).toDouble())
        return distFromEnd <= threshold
    }

    private fun updateScrolledNearEndState() {
        if (!didScrollToEndInitially) return
        val scrollView = findScrollView() ?: return
        if (scrollView.getChildAt(0) == null) return

        val isNearEnd = getIsScrolledNearEnd(distFromEnd)
        if (isNearEnd == prevIsScrolledNearEnd) return

        prevIsScrolledNearEnd = isNearEnd
        onScrolledNearEndChange?.invoke(isNearEnd)
    }

    private fun shouldScrollOnFooterSizeUpdate(): Boolean {
        val settings = scrollOnFooterSizeUpdate ?: return false
        if (settings.enabled == false) return false
        findScrollView() ?: return false

        val threshold = settings.scrolledToEndThreshold ?: 100.0
        return distFromEnd <= threshold
    }

    private fun measureViewBottomOffset(): Float {
        view.getLocationInWindow(locationBuffer)
        val viewBottom = locationBuffer[1] + view.height
        val windowHeight = view.rootView.height
        return max(0f, (windowHeight - viewBottom).toFloat())
    }

    private fun snapshotViewBottomOffset() {
        cachedViewBottomOffset = measureViewBottomOffset()
    }

    private fun applyKeyboardFrame(imeHeight: Float, imeVisible: Boolean) {
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

        applyAllInsets()
        composerView?.view?.translationY = -(nextKeyboardHeight + computeComposerOffset())
    }

    private fun computeComposerOffset(): Float {
        val offset = composerView?.stickToKeyboard?.offset
        val offsetWhenClosed = offset?.whenKeyboardClosed?.toFloat() ?: 0f
        val offsetWhenOpen = offset?.whenKeyboardOpen?.toFloat() ?: 0f
        return offsetWhenClosed + (offsetWhenOpen - offsetWhenClosed) * keyboardProgress
    }

    private fun setupKeyboardInsets() {
        val imeType = WindowInsetsCompat.Type.ime()

        ViewCompat.setOnApplyWindowInsetsListener(view) { _, insets ->
            if (!isImeAnimationRunning) {
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

                    snapshotViewBottomOffset()
                    runningImeAnimationsCount += 1
                    isImeAnimationRunning = true
                }

                override fun onProgress(
                    insets: WindowInsetsCompat,
                    runningAnimations: MutableList<WindowInsetsAnimationCompat>,
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
                        snapshotViewBottomOffset()

                        val rootInsets = ViewCompat.getRootWindowInsets(view)
                        val imeHeight = rootInsets?.getInsets(imeType)?.bottom?.toFloat() ?: 0f
                        val imeVisible = (rootInsets?.isVisible(imeType) == true) && imeHeight > 0f
                        applyKeyboardFrame(imeHeight, imeVisible)

                        if (pendingAnimatedScroll) {
                            pendingAnimatedScroll = false
                            scrollToEndInternal(animated = true) {
                                onDidScrollToIndex?.invoke()
                            }
                        }
                    }
                }
            },
        )
    }
}
