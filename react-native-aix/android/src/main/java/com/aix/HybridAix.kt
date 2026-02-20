package com.aix

import android.graphics.Color
import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.aix.*

@Keep
@DoNotStrip
class HybridAix(val context: ThemedReactContext): HybridAixSpec() {
    // View
    override val view: View = View(context)

    // Props
    override var shouldStartAtEnd: Boolean = true
    override var scrollOnFooterSizeUpdate: AixScrollOnFooterSizeUpdate? = null
    override var scrollEndReachedThreshold: Double? = null
    override var additionalContentInsets: AixAdditionalContentInsetsProp? = null
    override var additionalScrollIndicatorInsets: AixScrollIndicatorInsets? = null
    override var mainScrollViewID: String? = null
    override var penultimateCellIndex: Double? = null
    override var shouldApplyContentInsets: Boolean? = null
    override var applyContentInsetDelay: Double? = null
    override var onWillApplyContentInsets: ((insets: AixContentInsets) -> Unit)? = null
    override var onScrolledNearEndChange: ((isNearEnd: Boolean) -> Unit)? = null

    // Methods
    override fun scrollToEnd(animated: Boolean?) {
        // TODO: Implement for Android
    }

    override fun scrollToIndexWhenBlankSizeReady(index: Double, animated: Boolean?, waitForKeyboardToEnd: Boolean?) {
        // TODO: Implement for Android
    }

    override fun getFirstVisibleCellInfo(): AixVisibleCellInfo? {
        // TODO: Implement for Android
        return null
    }

    override fun scrollToCellOffset(cellIndex: Double, offsetInCell: Double, animated: Boolean?) {
        // TODO: Implement for Android
    }
}
