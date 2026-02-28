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

            setupKeyboardInsets()
        }

        override fun onDetachedFromWindow() {
            super.onDetachedFromWindow()
            ViewCompat.setOnApplyWindowInsetsListener(this, null)
        }
    }

    override val view: View = InnerView(context)

    // AixContext Implementation
    override var blankView: HybridAixCellView? = null
    override var composerView: HybridAixComposer? = null
    
    override var keyboardHeight: Float = 0f
    override var keyboardHeightWhenOpen: Float = 0f

    private var composerHeight: Float = 0f
    private val cells = mutableMapOf<Int, HybridAixCellView>()
    private var cachedScrollView: ReactScrollView? = null

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
        val additionalBottom = additionalContentInsets?.bottom?.whenKeyboardClosed?.toFloat() ?: 0f // simplified
        
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

    private fun setupKeyboardInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
            val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val imeHeight = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom.toFloat()
            
            if (imeVisible) {
                keyboardHeight = imeHeight
                if (imeHeight > keyboardHeightWhenOpen) {
                    keyboardHeightWhenOpen = imeHeight
                }
            } else {
                keyboardHeight = 0f
            }
            
            updateBlankSizeAndScroll()
            composerView?.view?.translationY = -keyboardHeight // Simulating sticky composer
            
            insets
        }

        ViewCompat.setWindowInsetsAnimationCallback(
            view,
            object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_STOP) {
                override fun onProgress(
                    insets: WindowInsetsCompat,
                    runningAnimations: MutableList<WindowInsetsAnimationCompat>
                ): WindowInsetsCompat {
                    val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
                    val imeHeight = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom.toFloat()

                    keyboardHeight = imeHeight
                    if (imeVisible && imeHeight > keyboardHeightWhenOpen) {
                        keyboardHeightWhenOpen = imeHeight
                    }

                    updateBlankSizeAndScroll()
                    composerView?.view?.translationY = -keyboardHeight

                    return insets
                }

                override fun onEnd(animation: WindowInsetsAnimationCompat) {
                    super.onEnd(animation)
                    if (queuedScrollToEnd?.waitForKeyboardToEnd == true) {
                        flushQueuedScrollToEnd(force = true)
                    }
                }
            }
        )
    }
}
