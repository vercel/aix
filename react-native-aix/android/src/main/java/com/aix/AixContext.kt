package com.aix

import android.view.View

interface AixContext {
    var blankView: HybridAixCellView?
    var composerView: HybridAixComposer?
    
    val keyboardHeight: Float
    val keyboardHeightWhenOpen: Float

    fun reportBlankViewSizeChange(height: Float, index: Int)
    fun registerCell(cell: HybridAixCellView)
    fun unregisterCell(cell: HybridAixCellView)
    fun registerComposerView(composerView: HybridAixComposer)
    fun unregisterComposerView(composerView: HybridAixComposer)
    fun reportComposerHeightChange(height: Float)
}

fun View.getAixContext(): AixContext? {
    var node: android.view.ViewParent? = this.parent
    while (node != null && node is View) {
        val ctx = node.getTag(R.id.aix_context) as? AixContext
        if (ctx != null) {
            return ctx
        }
        node = node.parent
    }
    return null
}
