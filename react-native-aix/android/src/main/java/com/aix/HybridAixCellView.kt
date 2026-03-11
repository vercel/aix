package com.aix

import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.margelo.nitro.aix.*

@Keep
@DoNotStrip
class HybridAixCellView(val context: ThemedReactContext): HybridAixCellViewSpec() {
    
    inner class InnerView(context: ThemedReactContext) : ReactViewGroup(context) {
        private var isRegistered = false

        override fun onAttachedToWindow() {
            super.onAttachedToWindow()
            val ctx = getAixContext()
            ctx?.registerCell(this@HybridAixCellView)
            isRegistered = true
        }

        override fun onDetachedFromWindow() {
            super.onDetachedFromWindow()
            if (isRegistered) {
                getAixContext()?.unregisterCell(this@HybridAixCellView)
                isRegistered = false
            }
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            super.onSizeChanged(w, h, oldw, oldh)
            val ctx = getAixContext()
            if (isLast) {
                ctx?.reportBlankViewSizeChange(h.toFloat(), index.toInt())
            } else if (oldh > 0) {
                // Non-blank cell changed height after initial layout (e.g. streaming)
                ctx?.reportCellHeightChange(index.toInt(), h.toFloat())
            }
        }
    }

    override val view: View = InnerView(context)

    private var _isLast: Boolean = false
    override var isLast: Boolean
        get() = _isLast
        set(value) {
            val changed = _isLast != value
            _isLast = value
            if (changed) {
                val ctx = view.getAixContext()
                if (value) {
                    ctx?.registerCell(this)
                    ctx?.reportBlankViewSizeChange(view.height.toFloat(), index.toInt())
                } else if (ctx?.blankView === this) {
                    ctx.blankView = null
                }
            }
        }

    private var _index: Double = 0.0
    override var index: Double
        get() = _index
        set(value) {
            val changed = _index != value
            _index = value
            if (changed) {
                view.getAixContext()?.registerCell(this)
            }
        }
}
