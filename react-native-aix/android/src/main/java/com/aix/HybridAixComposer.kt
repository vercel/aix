package com.aix

import android.view.View
import android.view.ViewGroup
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.margelo.nitro.aix.*

@Keep
@DoNotStrip
class HybridAixComposer(val context: ThemedReactContext): HybridAixComposerSpec() {

    inner class InnerView(context: ThemedReactContext) : ReactViewGroup(context) {
        private var isRegistered = false

        override fun onAttachedToWindow() {
            super.onAttachedToWindow()
            val ctx = getAixContext()
            ctx?.registerComposerView(this@HybridAixComposer)
            isRegistered = true
        }

        override fun onDetachedFromWindow() {
            super.onDetachedFromWindow()
            if (isRegistered) {
                getAixContext()?.unregisterComposerView(this@HybridAixComposer)
                isRegistered = false
            }
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            super.onSizeChanged(w, h, oldw, oldh)
            getAixContext()?.reportComposerHeightChange(h.toFloat())
        }
    }

    override val view: View = InnerView(context)

    override var stickToKeyboard: AixStickToKeyboard? = null
    override var fixInput: Boolean? = null
}
