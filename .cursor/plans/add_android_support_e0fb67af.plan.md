---
name: Add Android Support
overview: Implement Android support for the Aix React Native Nitro Module, providing one-to-one behavioral parity with the iOS implementation for keyboard-aware chat message lists.
todos:
  - id: aix-context
    content: Create AixContext interface and context-finding utilities
    status: completed
  - id: hybrid-aix
    content: Implement HybridAix.kt with keyboard handling, scroll management, and blank size calculation
    status: completed
  - id: hybrid-cell
    content: Implement HybridAixCellView.kt with size reporting and context registration
    status: completed
  - id: hybrid-composer
    content: Implement HybridAixComposer.kt with height tracking
    status: completed
  - id: aix-package
    content: Update AixPackage.kt to register all ViewManagers
    status: completed
  - id: testing
    content: Build and test the existing example app on Android emulator/device
    status: in_progress
---

# Add Android Support to Aix Nitro Module

## Overview

The Aix library is a native chat message list implementation that handles:

- Keyboard-aware scrolling with content inset management
- Blank size calculation (space needed to push content to top of visible area)
- Scroll-to-end functionality with queued operations
- Composer height tracking
- Cell registration and size reporting

## Key Behavioral Requirements

Based on the iOS implementation in [`HybridAix.swift`](react-native-aix/ios/HybridAix.swift), the Android implementation must:

1. **Find and manage a scroll view** within the view hierarchy (by ID or iteration)
2. **Track keyboard state** (will show, did show, will hide, did hide, height changes)
3. **Calculate blank size** - the space needed so the last message can scroll to the top
4. **Apply content insets** - bottom inset = blankSize + keyboardHeight + composerHeight + additionalInset
5. **Handle scroll-to-end** with queued operations that wait for blank size updates
6. **Interpolate scroll position** during keyboard open/close animations
7. **Register/unregister cells and composer** via context pattern

## Android-Specific Challenges

| iOS Concept | Android Equivalent |

|-------------|-------------------|

| `UIScrollView.contentInset.bottom` | No direct equivalent - use padding with `clipToPadding=false` |

| `UIScrollView.contentOffset` | `scrollY` / `scrollTo()` |

| `UIScrollView.setContentOffset(animated:)` | `smoothScrollTo()` / `scrollTo()` |

| `UIScrollView.verticalScrollIndicatorInsets` | No direct API - requires custom implementation |

| Keyboard notifications | `WindowInsetsAnimation.Callback` (API 30+) or `ViewTreeObserver.OnGlobalLayoutListener` |

| `objc_setAssociatedObject` (context) | View tags or static WeakHashMap |

| `UIView.layoutSubviews()` | `View.OnLayoutChangeListener` or `ViewTreeObserver.OnGlobalLayoutListener` |

## Implementation Plan

### 1. Create AixContext Interface

Create a Kotlin interface mirroring the iOS `AixContext` protocol. This allows child views (cells, composer) to communicate with the parent Aix controller.

```kotlin
// android/src/main/java/com/aix/AixContext.kt
interface AixContext {
    var blankView: HybridAixCellView?
    var composerView: HybridAixComposer?
    
    fun reportBlankViewSizeChange(width: Float, height: Float, index: Int)
    fun registerCell(cell: HybridAixCellView)
    fun unregisterCell(cell: HybridAixCellView)
    fun registerComposerView(composer: HybridAixComposer)
    fun unregisterComposerView(composer: HybridAixComposer)
    fun reportComposerHeightChange(height: Float)
}
```

### 2. Implement HybridAix.kt

The main controller class (~800 lines). Key responsibilities:

**Properties to implement:**

- `shouldStartAtEnd: Boolean`
- `scrollOnFooterSizeUpdate: AixScrollOnFooterSizeUpdate?`
- `scrollEndReachedThreshold: Double?`
- `additionalContentInsets: AixAdditionalContentInsetsProp?`
- `additionalScrollIndicatorInsets: AixScrollIndicatorInsets?`
- `mainScrollViewID: String?`
- `penultimateCellIndex: Double?`

**Methods to implement:**

- `scrollToEnd(animated: Boolean?)`
- `scrollToIndexWhenBlankSizeReady(index: Double, animated: Boolean?, waitForKeyboardToEnd: Boolean?)`

**Internal systems:**

- Keyboard observer using `WindowInsetsAnimationCompat.Callback`
- Scroll view finder (by nativeID or view hierarchy iteration)
- Blank size calculation
- Content padding application (simulating iOS contentInset)
- Scroll position interpolation during keyboard animations
- Queued scroll-to-end operations

### 3. Implement HybridAixCellView.kt

Cell wrapper (~150 lines):

**Properties:**

- `isLast: Boolean` - marks this as the blank view for calculations
- `index: Double` - position in list

**Behavior:**

- Register with AixContext when attached to window
- Unregister when detached
- Report size changes via `OnLayoutChangeListener`
- Update blank view status when `isLast` changes

### 4. Implement HybridAixComposer.kt

Composer wrapper (~100 lines):

**Behavior:**

- Register with AixContext when attached
- Unregister when detached
- Report height changes via `OnLayoutChangeListener`

### 5. Update AixPackage.kt

Register all three ViewManagers:

```kotlin
override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return listOf(
        HybridAixManager(),
        HybridAixCellViewManager(),
        HybridAixComposerManager()
    )
}
```

## Technical Deep Dive

### Keyboard Handling on Android

Use `WindowInsetsAnimationCompat.Callback` for smooth keyboard animations:

```kotlin
ViewCompat.setWindowInsetsAnimationCallback(view, object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_STOP) {
    override fun onPrepare(animation: WindowInsetsAnimationCompat) {
        // Capture scroll position before animation
    }
    
    override fun onProgress(
        insets: WindowInsetsCompat,
        runningAnimations: List<WindowInsetsAnimationCompat>
    ): WindowInsetsCompat {
        // Update during animation (like iOS handleKeyboardMove)
        val imeHeight = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        // Apply content padding and interpolate scroll
        return insets
    }
    
    override fun onEnd(animation: WindowInsetsAnimationCompat) {
        // Finalize (like iOS handleKeyboardDidMove)
    }
})
```

### Simulating contentInset on Android

iOS `contentInset.bottom` adds scrollable space after content. On Android, achieve this with:

```kotlin
scrollView.apply {
    clipToPadding = false
    setPadding(0, paddingTop, 0, calculatedBottomInset.toInt())
}
```

For RecyclerView, also need to handle item decoration or padding.

### Finding the ScrollView

```kotlin
private fun findScrollView(root: View, id: String? = null): ScrollView? {
    // First try by nativeID (accessibilityIdentifier equivalent)
    if (id != null) {
        val tagged = root.findViewWithTag<View>(id)
        if (tagged is ScrollView) return tagged
    }
    
    // Fallback to iteration
    return findFirstScrollView(root)
}

private fun findFirstScrollView(view: View): ScrollView? {
    if (view is ScrollView || view is RecyclerView) {
        return view as? ScrollView
    }
    if (view is ViewGroup) {
        for (i in 0 until view.childCount) {
            val found = findFirstScrollView(view.getChildAt(i))
            if (found != null) return found
        }
    }
    return null
}
```

### Context Finding Pattern

Replace iOS associated objects with a static WeakHashMap:

```kotlin
companion object {
    private val contextMap = WeakHashMap<View, AixContext>()
    
    fun setContext(view: View, context: AixContext?) {
        if (context != null) contextMap[view] = context
        else contextMap.remove(view)
    }
    
    fun findContext(view: View): AixContext? {
        var current: View? = view
        while (current != null) {
            contextMap[current]?.let { return it }
            current = current.parent as? View
        }
        return null
    }
}
```

## Files to Create/Modify

| File | Action |

|------|--------|

| `android/src/main/java/com/aix/AixContext.kt` | Create - Interface definition |

| `android/src/main/java/com/aix/HybridAix.kt` | Rewrite - Full implementation |

| `android/src/main/java/com/aix/HybridAixCellView.kt` | Create - Cell view implementation |

| `android/src/main/java/com/aix/HybridAixComposer.kt` | Create - Composer implementation |

| `android/src/main/java/com/aix/AixPackage.kt` | Modify - Register all ViewManagers |

## Testing Strategy

The existing example app is written in React Native and already uses the Aix components. No changes to the example app are needed - once the Android native implementation is complete, the example app will work on Android automatically.

Testing steps:

1. Build the example app on Android (`cd react-native-aix/example && npx react-native run-android`)
2. Verify keyboard open/close animations are smooth
3. Verify blank size calculation positions content correctly
4. Verify scroll-to-end works with and without animation
5. Verify queued scroll operations work correctly
6. Test with different keyboard heights and orientations
7. Test app backgrounding/foregrounding with keyboard open