package com.aix

import android.view.View
import android.view.ViewGroup
import java.lang.ref.WeakReference
import java.util.WeakHashMap

/**
 * Protocol that defines the Aix context interface for child views to communicate with.
 * This mirrors the iOS AixContext protocol.
 */
interface AixContext {
    /** The blank view (last cell) - used for calculating blank size */
    var blankView: HybridAixCellView?

    /** The composer view */
    var composerView: HybridAixComposer?

    /** Called when the blank view's size changes */
    fun reportBlankViewSizeChange(width: Float, height: Float, index: Int)

    /** Register a cell with the context */
    fun registerCell(cell: HybridAixCellView)

    /** Unregister a cell from the context */
    fun unregisterCell(cell: HybridAixCellView)

    /** Register the composer view */
    fun registerComposerView(composerView: HybridAixComposer)

    /** Unregister the composer view */
    fun unregisterComposerView(composerView: HybridAixComposer)

    /** Called when the composer's height changes */
    fun reportComposerHeightChange(height: Float)
}

/**
 * Companion object providing utilities for finding AixContext in the view hierarchy.
 * This replaces iOS's objc_setAssociatedObject pattern with a WeakHashMap.
 */
object AixContextFinder {
    private val contextMap = WeakHashMap<View, WeakReference<AixContext>>()

    /**
     * Associate an AixContext with a view.
     */
    fun setContext(view: View, context: AixContext?) {
        if (context != null) {
            contextMap[view] = WeakReference(context)
        } else {
            contextMap.remove(view)
        }
    }

    /**
     * Walk up the view hierarchy to find the nearest AixContext.
     * This mirrors iOS's useAixContext() extension method.
     */
    fun findContext(view: View): AixContext? {
        var current: View? = view
        while (current != null) {
            contextMap[current]?.get()?.let { return it }
            current = current.parent as? View
        }
        return null
    }

    /**
     * Recursively search subviews to find a scrollable view by nativeID (tag).
     * On Android, nativeID maps to View.tag.
     */
    fun findScrollViewWithTag(root: View, tag: String): View? {
        if (root.tag == tag && isScrollableView(root)) {
            return root
        }
        if (root is ViewGroup) {
            for (i in 0 until root.childCount) {
                val found = findScrollViewWithTag(root.getChildAt(i), tag)
                if (found != null) return found
            }
        }
        return null
    }

    /**
     * Recursively search subviews to find the first scrollable view.
     */
    fun findFirstScrollView(view: View): View? {
        if (isScrollableView(view)) {
            return view
        }
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val found = findFirstScrollView(view.getChildAt(i))
                if (found != null) return found
            }
        }
        return null
    }

    /**
     * Check if a view is a scrollable container.
     * Supports ScrollView, HorizontalScrollView, NestedScrollView, and RecyclerView.
     */
    private fun isScrollableView(view: View): Boolean {
        val className = view.javaClass.name
        return className.contains("ScrollView") ||
               className.contains("RecyclerView") ||
               view is android.widget.ScrollView ||
               view is android.widget.HorizontalScrollView
    }
}
