package com.aix

import android.view.View
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.margelo.nitro.aix.views.*

class CustomAixManager: ViewGroupManager<ReactViewGroup>() {
  private val views = hashMapOf<View, HybridAix>()

  override fun getName(): String = "Aix"

  override fun createViewInstance(reactContext: ThemedReactContext): ReactViewGroup {
    val hybridView = HybridAix(reactContext)
    val view = hybridView.view as ReactViewGroup
    views[view] = hybridView
    return view
  }

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)
    views.remove(view)
  }

  override fun updateState(view: ReactViewGroup, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
    val hybridView = views[view] ?: throw Error("Couldn't find view $view in local views table!")
    hybridView.beforeUpdate()
    HybridAixStateUpdater.updateViewProps(hybridView, stateWrapper)
    hybridView.afterUpdate()
    return super.updateState(view, props, stateWrapper)
  }
}

class CustomAixCellViewManager: ViewGroupManager<ReactViewGroup>() {
  private val views = hashMapOf<View, HybridAixCellView>()

  override fun getName(): String = "AixCellView"

  override fun createViewInstance(reactContext: ThemedReactContext): ReactViewGroup {
    val hybridView = HybridAixCellView(reactContext)
    val view = hybridView.view as ReactViewGroup
    views[view] = hybridView
    return view
  }

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)
    views.remove(view)
  }

  override fun updateState(view: ReactViewGroup, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
    val hybridView = views[view] ?: throw Error("Couldn't find view $view in local views table!")
    hybridView.beforeUpdate()
    HybridAixCellViewStateUpdater.updateViewProps(hybridView, stateWrapper)
    hybridView.afterUpdate()
    return super.updateState(view, props, stateWrapper)
  }
}

class CustomAixComposerManager: ViewGroupManager<ReactViewGroup>() {
  private val views = hashMapOf<View, HybridAixComposer>()

  override fun getName(): String = "AixComposer"

  override fun createViewInstance(reactContext: ThemedReactContext): ReactViewGroup {
    val hybridView = HybridAixComposer(reactContext)
    val view = hybridView.view as ReactViewGroup
    views[view] = hybridView
    return view
  }

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)
    views.remove(view)
  }

  override fun updateState(view: ReactViewGroup, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
    val hybridView = views[view] ?: throw Error("Couldn't find view $view in local views table!")
    hybridView.beforeUpdate()
    HybridAixComposerStateUpdater.updateViewProps(hybridView, stateWrapper)
    hybridView.afterUpdate()
    return super.updateState(view, props, stateWrapper)
  }
}

class CustomAixInputWrapperManager: ViewGroupManager<ReactViewGroup>() {
  private val views = hashMapOf<View, HybridAixInputWrapper>()

  override fun getName(): String = "AixInputWrapper"

  override fun createViewInstance(reactContext: ThemedReactContext): ReactViewGroup {
    val hybridView = HybridAixInputWrapper(reactContext)
    val view = hybridView.view as ReactViewGroup
    views[view] = hybridView
    return view
  }

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)
    views.remove(view)
  }

  override fun updateState(view: ReactViewGroup, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
    val hybridView = views[view] ?: throw Error("Couldn't find view $view in local views table!")
    hybridView.beforeUpdate()
    HybridAixInputWrapperStateUpdater.updateViewProps(hybridView, stateWrapper)
    hybridView.afterUpdate()
    return super.updateState(view, props, stateWrapper)
  }
}

class CustomAixDropzoneManager: ViewGroupManager<ReactViewGroup>() {
  private val views = hashMapOf<View, HybridAixDropzone>()

  override fun getName(): String = "AixDropzone"

  override fun createViewInstance(reactContext: ThemedReactContext): ReactViewGroup {
    val hybridView = HybridAixDropzone(reactContext)
    val view = hybridView.view as ReactViewGroup
    views[view] = hybridView
    return view
  }

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)
    views.remove(view)
  }

  override fun updateState(view: ReactViewGroup, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
    val hybridView = views[view] ?: throw Error("Couldn't find view $view in local views table!")
    hybridView.beforeUpdate()
    HybridAixDropzoneStateUpdater.updateViewProps(hybridView, stateWrapper)
    hybridView.afterUpdate()
    return super.updateState(view, props, stateWrapper)
  }
}
