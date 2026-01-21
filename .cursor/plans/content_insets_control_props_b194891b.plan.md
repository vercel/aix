---
name: Content Insets Control Props
overview: Implement `shouldApplyContentInsets` and `onWillApplyContentInsets` props in the native iOS code, create a `useContentInsetHandler` hook for Reanimated integration, and update the example app to demonstrate JS-controlled content insets.
todos:
  - id: optional-insets
    content: Make AixContentInsets fields optional in aix.nitro.ts and regenerate nitrogen
    status: completed
  - id: swift-props
    content: Add shouldApplyContentInsets and onWillApplyContentInsets properties to HybridAix class
    status: completed
  - id: swift-logic
    content: Modify applyContentInset() to check shouldApplyContentInsets and call callback when false
    status: completed
  - id: aix-wrapper
    content: Update Aix component in aix.tsx to wrap onWillApplyContentInsets with callback()
    status: completed
  - id: create-hook
    content: Create useContentInsetHandler hook in react-native-aix/src/hooks/
    status: completed
  - id: export-hook
    content: Export useContentInsetHandler from react-native-aix/src/index.ts
    status: completed
  - id: peer-dep
    content: Add react-native-reanimated as peer dependency
    status: completed
  - id: example-app
    content: Update example app to demonstrate JS-controlled content insets with Reanimated
    status: completed
---

# Implement Content Insets Control Props

## Overview

Add the ability for JS to control content inset application via two new props:

- `shouldApplyContentInsets?: boolean` - when `false`, native skips applying insets
- `onWillApplyContentInsets?: (insets: AixContentInsets) => void` - callback fired with inset values

This enables Reanimated-driven content inset animations controlled from JS.

## 1. Make AixContentInsets Fields Optional

Update `react-native-aix/src/views/aix.nitro.ts` to make inset fields optional:

```typescript
export interface AixContentInsets {
  top?: number
  left?: number
  bottom?: number
  right?: number
}
```

After this change, run `bun nitrogen` in `react-native-aix/` to regenerate native code. This will update the generated Swift/Kotlin structs to use optional types.

## 2. Implement Props in HybridAix.swift

Add the two properties to the `HybridAix` class:

```swift
// Add properties
var shouldApplyContentInsets: Bool? = nil
var onWillApplyContentInsets: ((_ insets: AixContentInsets) -> Void)? = nil
```

Modify `applyContentInset()` to check `shouldApplyContentInsets` and call the callback:

```swift
func applyContentInset(contentInsetBottom overrideContentInsetBottom: CGFloat? = nil) {
    guard let scrollView else { return }

    let targetTop = additionalContentInsetTop
    let targetBottom = overrideContentInsetBottom ?? self.contentInsetBottom
    
    // Create insets struct for callback (fields are optional in the interface)
    let insets = AixContentInsets(
        top: Double(targetTop),
        left: nil,
        bottom: Double(targetBottom),
        right: nil
    )
    
    // If shouldApplyContentInsets is explicitly false, call callback and return
    if shouldApplyContentInsets == false {
        onWillApplyContentInsets?(insets)
        return
    }
    
    // Default behavior: apply insets directly
    if scrollView.contentInset.top != targetTop {
        scrollView.contentInset.top = targetTop
    }
    if scrollView.contentInset.bottom != targetBottom {
        scrollView.contentInset.bottom = targetBottom
    }
}
```

## 3. Update Aix Component to Wrap Callback

Update `react-native-aix/src/aix.tsx` to wrap `onWillApplyContentInsets` with `callback()` internally before passing to the native component. This hides the Nitro implementation detail from consumers.

```typescript
import { callback } from 'react-native-nitro-modules'

export const Aix = forwardRef<AixRef, React.ComponentProps<typeof AixInternal>>(
  function Aix(props, ref) {
    return (
      <AixInternal
        {...props}
        // Wrap onWillApplyContentInsets with callback() if provided
        onWillApplyContentInsets={
          props.onWillApplyContentInsets
            ? callback(props.onWillApplyContentInsets)
            : undefined
        }
        // ... other props
      />
    )
  }
)
```

## 4. Create useContentInsetHandler Hook

Create new file `react-native-aix/src/hooks/useContentInsetHandler.ts`.

The hook returns the raw `useEvent` result. The `Aix` component handles wrapping with `callback()` internally.

```typescript
import { useEvent, useHandler } from 'react-native-reanimated'
import type { AixContentInsets } from '../views/aix.nitro'

type ContentInsetHandlers<Context extends Record<string, unknown>> = {
  onContentInset?: (insets: AixContentInsets, context: Context) => void
}

export function useContentInsetHandler<
  Context extends Record<string, unknown> = Record<string, unknown>
>(
  handlers: ContentInsetHandlers<Context>,
  dependencies?: unknown[]
) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies)

  // Returns raw useEvent result - Aix component wraps with callback() internally
  return useEvent(
    (event: AixContentInsets) => {
      'worklet'
      if (handlers.onContentInset) {
        handlers.onContentInset(event, context)
      }
    },
    ['onWillApplyContentInsets'],
    doDependenciesDiffer
  )
}
```

Usage - clean, no callback() needed:

```typescript
const bottomInset = useSharedValue<number | null>(null)

const contentInsetHandler = useContentInsetHandler({
  onContentInset: (insets) => {
    'worklet'
    bottomInset.value = insets.bottom ?? null
  }
})

// Just pass directly - Aix wraps with callback() internally
<Aix
  shouldApplyContentInsets={false}
  onWillApplyContentInsets={contentInsetHandler}
/>
```

## 5. Export Hook from Package

Update `react-native-aix/src/index.ts`:

```typescript
export { useContentInsetHandler } from './hooks/useContentInsetHandler'
```

## 6. Add Reanimated as Peer Dependency

Update `react-native-aix/package.json`:

```json
"peerDependencies": {
  "react": "*",
  "react-native": "*",
  "react-native-nitro-modules": "*",
  "react-native-reanimated": ">=3.0.0"
}
```

## 7. Update Example App

Update `react-native-aix/example/App.tsx` to demonstrate the feature. For simplicity, only track the bottom inset:

```tsx
import { Aix, useContentInsetHandler } from 'aix'
import Animated, { useSharedValue, useAnimatedProps } from 'react-native-reanimated'

// Wrap Aix with Animated for Reanimated event handling
const AnimatedAix = Animated.createAnimatedComponent(Aix)

function Chat({ children }) {
  // Only track bottom inset for now
  const bottomInset = useSharedValue<number | null>(null)

  // Hook returns useEvent handler for worklet-based content inset handling
  const contentInsetHandler = useContentInsetHandler({
    onContentInset: (insets) => {
      'worklet'
      bottomInset.value = insets.bottom ?? null
    }
  })

  // Apply content insets via animated props
  const animatedScrollViewProps = useAnimatedProps(() => ({
    contentInset: {
      top: 0,
      bottom: bottomInset.value ?? 0,
      left: 0,
      right: 0,
    }
  }))

  return (
    <AnimatedAix
      shouldApplyContentInsets={false}
      onWillApplyContentInsets={contentInsetHandler}
      // ... other props
    >
      <Animated.ScrollView
        animatedProps={animatedScrollViewProps}
        keyboardDismissMode="interactive"
        nativeID={mainScrollViewID}
      >
        {/* content */}
      </Animated.ScrollView>
    </AnimatedAix>
  )
}
```

## Files to Modify

- [react-native-aix/ios/HybridAix.swift](react-native-aix/ios/HybridAix.swift) - Add props and modify `applyContentInset()`
- [react-native-aix/src/views/aix.nitro.ts](react-native-aix/src/views/aix.nitro.ts) - Make `AixContentInsets` fields optional
- [react-native-aix/src/aix.tsx](react-native-aix/src/aix.tsx) - Wrap `onWillApplyContentInsets` with `callback()`
- [react-native-aix/src/hooks/useContentInsetHandler.ts](react-native-aix/src/hooks/useContentInsetHandler.ts) - New file for the hook
- [react-native-aix/src/index.ts](react-native-aix/src/index.ts) - Export the hook
- [react-native-aix/package.json](react-native-aix/package.json) - Add reanimated peer dep
- [react-native-aix/example/App.tsx](react-native-aix/example/App.tsx) - Demonstrate usage