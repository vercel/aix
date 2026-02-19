# aix

Primitives for building beautiful AI chat apps with React Native.

> aix is currently in alpha preview. The API will change, and it is not yet feature complete.

We're rewriting the engine that powers the chat experience in the v0 mobile app with a focus on native feel.

aix is a native module with UIKit with Nitro Modules.

## Installation

```bash
npm i aix react-native-nitro-modules
```

Next, rebuild your native app. For Expo users, run `npx expo prebuild` and rebuild.

## Usage

Wrap your `ScrollView` with `Aix`, and wrap your messages with `AixCell`.

<details>
  <summary>Click here to view a full example</summary>
</details>

```tsx
import { Aix, AixCell } from 'aix'
import { Message } from 'path/to/your/message'
import { Composer } from 'path/to/your/composer'

export function ChatScreen({ messages }) {
  return (
    <Aix style={{ flex: 1 }}>
      <ScrollView>
        {messages.map((message) => (
          <AixCell key={message.id} index={index} isLast={index === messages.length - 1}>
            <Message message={message} />
          </AixCell>
        ))}
      </ScrollView>
    </Aix>
  )
}
```

To add a floating composer which lets content scroll under it, you can use the `AixFooter` and `KeyboardStickyView` from `react-native-keyboard-controller`:

```tsx
import { Aix, AixCell, AixFooter } from 'aix'
import { KeyboardStickyView } from 'react-native-keyboard-controller'

export function ChatScreen({ messages }) {
  return (
    <Aix style={{ flex: 1 }}>
      <ScrollView>
        {messages.map((message) => (
          <AixCell key={message.id} index={index} isLast={index === messages.length - 1}>
            <Message message={message} />
          </AixCell>
        ))}
      </ScrollView>

      <KeyboardStickyView offset={{ opened: 0, closed: -bottomInsetPadding }}>
        <AixFooter fixInput style={{ position: 'absolute', inset: 0, top: 'auto' }}>
          <Composer />
        </AixFooter>
      </KeyboardStickyView>
    </Aix>
  )
}
```

## TODOs

- [ ] Android support
- [ ] LegendList support
- [ ] FlashList support

## API Reference

### `Aix`

The main container component that provides keyboard-aware behavior and manages scrolling for chat interfaces.

#### Props

| Prop                              | Type                           | Default                                                           | Description                                                                                                                                                                                                                                                        |
| --------------------------------- | ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shouldStartAtEnd`                | `boolean`                      | -                                                                 | Whether the scroll view should start scrolled to the end of the content.                                                                                                                                                                                           |
| `scrollOnFooterSizeUpdate`        | `object`                       | `{ enabled: true, scrolledToEndThreshold: 100, animated: false }` | Control the behavior of scrolling when the footer size changes. By default, changing the height of the footer will shift content up in the scroll view.                                                                                                            |
| `scrollEndReachedThreshold`       | `number`                       | `max(blankSize, 200)`                                             | The number of pixels from the bottom of the scroll view to the end of the content that is considered "near the end". Used by `onScrolledNearEndChange` and to determine if content should shift up when keyboard opens.                                            |
| `onScrolledNearEndChange`         | `(isNearEnd: boolean) => void` | -                                                                 | Callback fired when the scroll position transitions between "near end" and "not near end" states. Reactive to user scrolling, content size changes, parent size changes, and keyboard height changes. Uses `scrollEndReachedThreshold` to determine the threshold. |
| `additionalContentInsets`         | `object`                       | -                                                                 | Additional content insets applied when keyboard is open or closed. Shape: `{ top?: { whenKeyboardOpen, whenKeyboardClosed }, bottom?: { whenKeyboardOpen, whenKeyboardClosed } }`                                                                                  |
| `additionalScrollIndicatorInsets` | `object`                       | -                                                                 | Additional insets for the scroll indicator, added to existing safe area insets. Applied to `verticalScrollIndicatorInsets` on iOS.                                                                                                                                 |
| `mainScrollViewID`                | `string`                       | -                                                                 | The `nativeID` of the scroll view to use. If provided, will search for a scroll view with this `accessibilityIdentifier`.                                                                                                                                          |
| `penultimateCellIndex`            | `number`                       | -                                                                 | The index of the second-to-last message (typically the last user message in AI chat apps). Used to determine which message will be scrolled into view. Useful when you have custom message types like timestamps in your list.                                     |

#### Ref Methods

Access these methods via `useAixRef()`:

```tsx
const aix = useAixRef()

// Scroll to the end of the content
aix.current?.scrollToEnd(animated)

// Scroll to a specific index when the blank size is ready
aix.current?.scrollToIndexWhenBlankSizeReady(index, animated, waitForKeyboardToEnd)
```

| Method                            | Parameters                                                          | Description                                                                |
| --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `scrollToEnd`                     | `animated?: boolean`                                                | Scrolls to the end of the content.                                         |
| `scrollToIndexWhenBlankSizeReady` | `index: number, animated?: boolean, waitForKeyboardToEnd?: boolean` | Scrolls to a specific cell index once the blank size calculation is ready. |

---

### `AixCell`

A wrapper component for each message in the list. It communicates cell position and dimensions to the parent `Aix` component.

#### Props

| Prop     | Type      | Required | Description                                                                                 |
| -------- | --------- | -------- | ------------------------------------------------------------------------------------------- |
| `index`  | `number`  | Yes      | The index of this cell in the message list.                                                 |
| `isLast` | `boolean` | Yes      | Whether this cell is the last item in the list. Used for scroll positioning and animations. |

---

### `AixFooter`

A footer component for floating composers that allows content to scroll underneath it. The footer's height is automatically tracked for proper scroll offset calculations.

#### Important Notes

- **Do not apply vertical padding** (`padding`, `paddingBottom`) directly to `AixFooter`. Apply padding to a child view instead.
- Position the footer absolutely at the bottom of the `Aix` container.

#### Recipe

```tsx
<AixFooter
  fixInput
  stickToKeyboard={{
    enabled: true,
    offset: {
      whenKeyboardOpen: 0,
      whenKeyboardClosed: bottomSafeAreaInset,
    },
  }}
  style={{ position: 'absolute', inset: 0, top: 'auto' }}
>
  <Composer />
</AixFooter>
```

#### Props

| Prop              | Type                 | Default | Description                                                                                                                                                                                                                                       |
| ----------------- | -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixInput`        | `boolean`            | -       | Patches the `TextInput` inside the footer to disable scroll bouncing, hide scroll indicators, enable interactive keyboard dismiss, and add swipe-up-to-focus. Recommended for multiline inputs. This may move to `AixInputWrapper` in the future. |
| `stickToKeyboard` | `AixStickToKeyboard` | -       | Controls whether the footer translates upward with the keyboard. See shape below.                                                                                                                                                                 |

Also accepts all standard React Native `View` props.

**`AixStickToKeyboard`**

| Field                       | Type      | Required | Description                                                                                   |
| --------------------------- | --------- | -------- | --------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | Yes      | Whether the footer should translate upward with the keyboard.                                 |
| `offset.whenKeyboardOpen`   | `number`  | No       | Additional vertical offset applied when the keyboard is fully open.                           |
| `offset.whenKeyboardClosed` | `number`  | No       | Additional vertical offset applied when the keyboard is closed (e.g. bottom safe area inset). |

---

### `AixDropzone`

A wrapper component that enables drag-and-drop file support for your chat interface. Users can drop images, documents, and other files onto the zone.

On iOS, this uses a native drop interaction handler. On other platforms, it renders its children without drop support.

#### Recipe

Wrap your chat screen with `AixDropzone` to handle dropped files:

```tsx
import { useState } from 'react'
import { AixDropzone, Aix, type AixInputWrapperOnPasteEvent } from 'aix'

function ChatScreen() {
  const [attachments, setAttachments] = useState<AixInputWrapperOnPasteEvent[]>([])

  return (
    <AixDropzone
      onDrop={(events) => {
        setAttachments((prev) => [...prev, ...events])
      }}
    >
      <Aix shouldStartAtEnd style={{ flex: 1 }}>
        {/* ScrollView, messages, footer... */}
      </Aix>
    </AixDropzone>
  )
}
```

#### Props

| Prop       | Type                                              | Default | Description                                                                            |
| ---------- | ------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `onDrop`   | `(events: AixInputWrapperOnPasteEvent[]) => void` | -       | Called when the user drops files onto the zone. Each event describes one dropped item. |
| `children` | `ReactNode`                                       | -       | Content to render inside the drop zone.                                                |

**`AixInputWrapperOnPasteEvent`**

| Field           | Type      | Description                                       |
| --------------- | --------- | ------------------------------------------------- |
| `type`          | `string`  | The kind of item (e.g. `"image"`).                |
| `filePath`      | `string`  | Local file path to the dropped or pasted content. |
| `fileExtension` | `string?` | File extension (e.g. `"png"`, `"pdf"`).           |
| `fileName`      | `string?` | Original file name.                               |

---

### `AixInputWrapper`

A wrapper for your `TextInput` that intercepts paste events, letting users paste images and files from their clipboard into the composer.

On iOS, this uses a native view that overrides paste behavior to capture rich content. On other platforms, it renders its children without paste interception.

#### Recipe

Wrap your `TextInput` with `AixInputWrapper` to handle pasted images and files:

```tsx
import { useState } from 'react'
import { TextInput } from 'react-native'
import { AixInputWrapper, type AixInputWrapperOnPasteEvent } from 'aix'

function Composer() {
  const [attachments, setAttachments] = useState<AixInputWrapperOnPasteEvent[]>([])

  return (
    <AixInputWrapper
      editMenuDefaultActions={['paste']}
      onPaste={(events) => {
        setAttachments((prev) => [...prev, ...events])
      }}
    >
      <TextInput placeholder='Type a message...' multiline />
    </AixInputWrapper>
  )
}
```

Each event in `onPaste` has the same [`AixInputWrapperOnPasteEvent`](#aixinputwrapperonpasteevent) shape described above.

#### Props

| Prop                     | Type                                              | Default | Description                                                                      |
| ------------------------ | ------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `onPaste`                | `(events: AixInputWrapperOnPasteEvent[]) => void` | -       | Called when the user pastes rich content (images, files) into the wrapped input. |
| `pasteConfiguration`     | `string[]`                                        | -       | UTI types to accept for paste events.                                            |
| `editMenuDefaultActions` | `string[]`                                        | -       | Which default edit menu actions to show (e.g. `['paste']`).                      |
| `maxLines`               | `number`                                          | -       | Maximum number of visible lines for the wrapped input.                           |
| `maxChars`               | `number`                                          | -       | Maximum character count for the wrapped input.                                   |
| `children`               | `ReactNode`                                       | -       | Should contain your `TextInput`.                                                 |

Also accepts all standard React Native `View` props.

---

### `TextFadeInStaggeredIfStreaming`

Animates text children with a staggered word-by-word fade-in effect. Each word fades in over 500ms, staggered 32ms apart. A pool system limits concurrent animations for smooth performance.

The `disabled` state is captured on mount. If the component mounts with `disabled={true}`, animation stays off even if `disabled` later becomes `false`. This prevents completed messages from re-animating on re-render.

#### Recipe

```tsx
import { Text } from 'react-native'
import { TextFadeInStaggeredIfStreaming } from 'aix'

function AssistantMessage({ content, isStreaming }) {
  return (
    <Text>
      <TextFadeInStaggeredIfStreaming disabled={!isStreaming}>
        {content}
      </TextFadeInStaggeredIfStreaming>
    </Text>
  )
}
```

#### Props

| Prop       | Type        | Required | Description                                                                                                             |
| ---------- | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `disabled` | `boolean`   | Yes      | Whether to disable the fade-in animation. Pass `true` for completed messages, `false` for currently-streaming messages. |
| `children` | `ReactNode` | -        | Text content to animate. String children are split by word and each word fades in individually.                         |

---

### `useAixRef`

A hook that returns a ref to access imperative methods on the `Aix` component.

```tsx
import { useAixRef } from 'aix'

function Chat({ messages }) {
  const aix = useAixRef()
  const send = useSendMessage()

  const handleSend = () => {
    // Scroll to end after sending a message
    send(message)
    aix.current?.scrollToIndexWhenBlankSizeReady(messages.length + 1, true)
    requestAnimationFrame(Keyboard.dismiss)
  }

  return <Aix ref={aix}>{/* ... */}</Aix>
}
```

---

### `useContentInsetHandler`

A hook for receiving content inset updates from the native scroll view. Use this when you want to apply content insets yourself (e.g. via Reanimated shared values) instead of letting `Aix` apply them natively.

#### Recipe

Apply content insets with Reanimated for custom control:

```tsx
import { Aix, useContentInsetHandler } from 'aix'
import { useSharedValue, useAnimatedProps } from 'react-native-reanimated'
import Animated from 'react-native-reanimated'

function Chat() {
  const bottomInset = useSharedValue<number | null>(null)

  const contentInsetHandler = useContentInsetHandler((insets) => {
    'worklet'
    bottomInset.set(insets.bottom ?? null)
  })

  const animatedScrollViewProps = useAnimatedProps(() => ({
    contentInset: {
      top: 0,
      bottom: bottomInset.get() ?? 0,
      left: 0,
      right: 0,
    },
  }))

  return (
    <Aix
      shouldStartAtEnd
      shouldApplyContentInsets={false}
      onWillApplyContentInsets={contentInsetHandler}
    >
      <Animated.ScrollView animatedProps={animatedScrollViewProps}>
        {/* messages... */}
      </Animated.ScrollView>
    </Aix>
  )
}
```

#### Parameters

| Parameter      | Type                                 | Description                                                              |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `handler`      | `(insets: AixContentInsets) => void` | Callback receiving computed content insets. Can be a Reanimated worklet. |
| `dependencies` | `unknown[]`                          | Dependency array for the callback (default: `[]`).                       |

**`AixContentInsets`**

| Field    | Type      | Description           |
| -------- | --------- | --------------------- |
| `top`    | `number?` | Top content inset.    |
| `left`   | `number?` | Left content inset.   |
| `bottom` | `number?` | Bottom content inset. |
| `right`  | `number?` | Right content inset.  |

---

### Scroll to End Button

You can use `onScrolledNearEndChange` to show a "scroll to end" button when the user scrolls away from the bottom:

```tsx
import { Aix, useAixRef } from 'aix'
import { useState } from 'react'

function Chat() {
  const aix = useAixRef()
  const [isNearEnd, setIsNearEnd] = useState(false)

  return (
    <Aix ref={aix} scrollEndReachedThreshold={200} onScrolledNearEndChange={setIsNearEnd}>
      {/* ScrollView and messages... */}

      {!isNearEnd && <Button onPress={() => aix.current?.scrollToEnd(true)} />}
    </Aix>
  )
}
```

## Requirements

- React Native v0.78.0 or higher
- Node 18.0.0 or higher
