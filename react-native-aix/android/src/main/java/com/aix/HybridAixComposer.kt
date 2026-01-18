package com.aix

import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.aix.HybridAixComposerSpec
import java.lang.ref.WeakReference

/**
 * HybridAixComposer wraps the chat composer input.
 * It registers itself with the AixContext so the context can track composer height
 * for calculating content insets.
 *
 * This mirrors the iOS HybridAixComposer implementation.
 */
@Keep
@DoNotStrip
class HybridAixComposer(private val context: ThemedReactContext) : HybridAixComposerSpec() {

    companion object {
        private const val TAG = "HybridAixComposer"
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
        // Make the view not intercept touches - let them pass through to children
        isClickable = false
        isFocusable = false
    }

    // MARK: - Private State

    /** Cached reference to the AixContext */
    private var cachedAixContext: WeakReference<AixContext>? = null

    /** Last reported height to avoid reporting unchanged heights */
    private var lastReportedHeight: Float = 0f

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
        Log.d(TAG, "Composer attached to window")

        // Clear cached context since hierarchy changed
        cachedAixContext = null

        // Register with the new context
        getAixContext()?.registerComposerView(this)
    }

    /**
     * Called when the view is about to be removed from window.
     */
    private fun handleDetachedFromWindow() {
        Log.d(TAG, "Composer detached from window")

        // Unregister from context before removal
        cachedAixContext?.get()?.unregisterComposerView(this)
        cachedAixContext = null
    }

    /**
     * Called when layout changes (size may have changed).
     */
    private fun handleLayoutChange() {
        val currentHeight = view.height.toFloat()

        if (currentHeight != lastReportedHeight) {
            lastReportedHeight = currentHeight
            Log.d(TAG, "Composer layout changed: height=$currentHeight")
            getAixContext()?.reportComposerHeightChange(currentHeight)
        }
    }
}
