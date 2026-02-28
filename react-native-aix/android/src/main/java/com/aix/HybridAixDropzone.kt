package com.aix

import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.aix.*

@Keep
@DoNotStrip
class HybridAixDropzone(val context: ThemedReactContext): HybridAixDropzoneSpec() {
    override val view: View = View(context)

    override var onDrop: ((events: Array<AixInputWrapperOnPasteEvent>) -> Unit)? = null
}
