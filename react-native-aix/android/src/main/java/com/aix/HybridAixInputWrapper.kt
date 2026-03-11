package com.aix

import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.aix.*

@Keep
@DoNotStrip
class HybridAixInputWrapper(val context: ThemedReactContext): HybridAixInputWrapperSpec() {
    override val view: View = View(context)

    override var pasteConfiguration: Array<String>? = null
    override var editMenuDefaultActions: Array<String>? = null
    override var maxLines: Double? = null
    override var maxChars: Double? = null
    override var onPaste: ((events: Array<AixInputWrapperOnPasteEvent>) -> Unit)? = null
}
