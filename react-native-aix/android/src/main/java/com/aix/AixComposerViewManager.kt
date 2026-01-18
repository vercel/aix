package com.aix

import android.view.View
import android.view.ViewGroup
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.margelo.nitro.aix.views.HybridAixComposerStateUpdater

/**
 * Custom ViewGroupManager for AixComposer that supports children.
 * This replaces the generated HybridAixComposerManager which extends SimpleViewManager.
 */
class AixComposerViewManager : ViewGroupManager<ViewGroup>() {
    private val views = hashMapOf<View, HybridAixComposer>()

    override fun getName(): String = "AixComposer"

    override fun createViewInstance(reactContext: ThemedReactContext): ViewGroup {
        val hybridView = HybridAixComposer(reactContext)
        val view = hybridView.view as ViewGroup
        views[view] = hybridView
        return view
    }

    override fun onDropViewInstance(view: ViewGroup) {
        super.onDropViewInstance(view)
        views.remove(view)
    }

    override fun updateState(view: ViewGroup, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
        val hybridView = views[view] ?: throw Error("Couldn't find view $view in local views table!")

        hybridView.beforeUpdate()
        HybridAixComposerStateUpdater.updateViewProps(hybridView, stateWrapper)
        hybridView.afterUpdate()

        return super.updateState(view, props, stateWrapper)
    }

    override fun addView(parent: ViewGroup, child: View, index: Int) {
        parent.addView(child, index)
    }

    override fun removeViewAt(parent: ViewGroup, index: Int) {
        parent.removeViewAt(index)
    }

    override fun getChildCount(parent: ViewGroup): Int = parent.childCount

    override fun getChildAt(parent: ViewGroup, index: Int): View? = parent.getChildAt(index)

    override fun needsCustomLayoutForChildren(): Boolean = false
}
