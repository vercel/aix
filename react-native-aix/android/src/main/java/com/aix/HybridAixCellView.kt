package com.aix

import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.aix.HybridAixCellViewSpec
import java.lang.ref.WeakReference

/**
 * HybridAixCellView wraps each list item in the chat (including the "blank" cell at the end).
 * It tracks its index and whether it's the last item,
 * and reports size changes to the AixContext.
 *
 * This mirrors the iOS HybridAixCellView implementation.
 */
@Keep
@DoNotStrip
class HybridAixCellView(private val context: ThemedReactContext) : HybridAixCellViewSpec() {

    companion object {
        private const val TAG = "HybridAixCellView"
    }

    // MARK: - Inner View

    /**
     * Custom ViewGroup that notifies owner when layout changes.
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

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            super.onSizeChanged(w, h, oldw, oldh)
            handleLayoutChange()
        }

        override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
            super.onLayout(changed, left, top, right, bottom)
            if (changed) {
                handleLayoutChange()
            }
        }
    }

    // MARK: - View

    override val view: View = InnerView(context).apply {
        // Make the view stretch horizontally
        layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }

    // MARK: - Properties

    private var _index: Double = 0.0
    override var index: Double
        get() = _index
        set(value) {
            if (_index != value) {
                _index = value
                updateRegistration()
            }
        }

    private var _isLast: Boolean = false
    override var isLast: Boolean
        get() = _isLast
        set(value) {
            if (_isLast != value) {
                _isLast = value
                updateBlankViewStatus()
            }
        }

    /** Cached reference to the AixContext */
    private var cachedAixContext: WeakReference<AixContext>? = null

    /** Last reported size to avoid reporting unchanged sizes */
    private var lastReportedSize = SizeReport(0f, 0f)

    private data class SizeReport(val width: Float, val height: Float)

    // MARK: - Context Access

    /**
     * Get the AixContext, caching it for performance.
     */
    private fun getAixContext(): AixContext? {
        cachedAixContext?.get()?.let { return it }
        val ctx = AixContextFinder.findContext(view)
        ctx?.let { cachedAixContext = WeakReference(it) }
        return ctx
    }

    // MARK: - Lifecycle Handlers

    /**
     * Called when the view is added to a window (full hierarchy is connected).
     */
    private fun handleAttachedToWindow() {
        Log.d(TAG, "Cell $index attached to window, isLast=$isLast")

        // Clear cached context since hierarchy changed
        cachedAixContext = null

        // Register with the new context
        getAixContext()?.registerCell(this)
    }

    /**
     * Called when the view is about to be removed from window.
     */
    private fun handleDetachedFromWindow() {
        Log.d(TAG, "Cell $index detached from window")

        // Unregister from context before removal
        cachedAixContext?.get()?.unregisterCell(this)
        cachedAixContext = null
    }

    /**
     * Called when layout changes (size may have changed).
     */
    private fun handleLayoutChange() {
        val currentWidth = view.width.toFloat()
        val currentHeight = view.height.toFloat()

        // Only report size changes for the last cell (blank view)
        // and only if the size actually changed
        if (isLast && (currentWidth != lastReportedSize.width || currentHeight != lastReportedSize.height)) {
            lastReportedSize = SizeReport(currentWidth, currentHeight)
            Log.d(TAG, "Cell $index layout changed: ${currentWidth}x${currentHeight}")
            getAixContext()?.reportBlankViewSizeChange(currentWidth, currentHeight, index.toInt())
        }
    }

    // MARK: - Registration

    /**
     * Update registration with context (called when index changes).
     */
    private fun updateRegistration() {
        getAixContext()?.registerCell(this)
    }

    /**
     * Update blank view status (called when isLast changes).
     */
    private fun updateBlankViewStatus() {
        val ctx = getAixContext() ?: return

        if (isLast) {
            // This cell is now the last one - become the blank view
            ctx.blankView = this
            val currentWidth = view.width.toFloat()
            val currentHeight = view.height.toFloat()
            lastReportedSize = SizeReport(currentWidth, currentHeight)
            ctx.reportBlankViewSizeChange(currentWidth, currentHeight, index.toInt())
        } else if (ctx.blankView === this) {
            // This cell is no longer last - clear blank view reference
            ctx.blankView = null
        }
    }
}
