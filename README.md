<img src="https://github.com/vercel/aix/blob/main/Aix.png?raw=true"
alt="aix" width="1600" height="900" />

# AIX

UI Primitives for building AI apps in React Native.

## Features

- Start a chat scrolled to end on the first frame
- Animate scrolling to new messages when they send
- Float messages to the top of the screen with automated "blank size" handling
- Animate message content as it streams
- Keyboard handling out-of-the-box with no external dependencies
- Support for absolute-positioned composers
- Detect "is scrolled near end" for ScrollToEnd buttons

To learn about the motivation behind AIX, you can read our blog post on [How we built the v0 iOS app](https://vercel.com/blog/how-we-built-the-v0-ios-app). AIX is an opinionated, feature-complete, and extensible way to implement every single feature mentioned in that blog post.

When building AIX, we started by copying the code from v0 into a separate repository. However, as we worked to make it flexible for use cases outside of our own app, we decided to rewrite it from scratch in native code. What you see here is a Nitro Module which handles all business logic in UIKit. We plan on adding support for Android as well and welcome contributions.

> aix is currently in alpha preview. The API may change.

## Installation

```bash
npm i aix react-native-nitro-modules
```

Next, rebuild your native app. For Expo users, run `npx expo prebuild` and
rebuild.

- For a full example, see the [example app](./react-native-aix/example/App.tsx).

## Usage

Wrap your `ScrollView` with `Aix`, and wrap your messages with `AixCell`.

```tsx
import { Aix, AixCell } from 'aix'
import { Message } from 'path/to/your/message'
import { Composer } from 'path/to/your/composer'

export function ChatScreen({ messages }) {
  return (
    <Aix style={{ flex: 1 }} shouldStartAtEnd>
      <ScrollView>
        {messages.map((message) => (
          <AixCell
            key={message.id}
            index={index}
            isLast={index === messages.length - 1}
          >
            <Message message={message} />
          </AixCell>
        ))}
      </ScrollView>
    </Aix>
  )
}
```

### Add a floating composer

To add a floating composer which lets content scroll under it, you can use the
`AixFooter`. Pair it with `Aix.scrollOnFooterSizeUpdate` to ensure content
scrolls under the footer when it changes size.

```tsx
import { Aix, AixCell, AixFooter } from 'aix'

export function ChatScreen({ messages }) {
  const { bottom } = useSafeAreaInsets()

  return (
    <Aix
      style={{ flex: 1 }}
      shouldStartAtEnd
      scrollOnFooterSizeUpdate={{
        enabled: true,
        scrolledToEndThreshold: 100,
        animated: false,
      }}
    >
      <ScrollView>
        {messages.map((message) => (
          <AixCell
            key={message.id}
            index={index}
            isLast={index === messages.length - 1}
          >
            <Message message={message} />
          </AixCell>
        ))}
      </ScrollView>

      <AixFooter
        style={{ position: 'absolute', inset: 0, top: 'auto' }}
        stickToKeyboard={{
          enabled: true,
          offset: {
            opened: 0,
            closed: -bottom,
          },
        }}
      >
        <Composer />
      </AixFooter>
    </Aix>
  )
}
```

### Send a message

When sending a message, you will likely want to scroll to it after it gets added
to the list.

Simply call `aix.current?.scrollToIndexWhenBlankSizeReady(index)` in your submit
handler.

The `index` you pass should correspond to the newest message in the list. For AI
chats, this is typically the next assistant message index.

```tsx
import { Keyboard } from 'react-native'
import { useAixRef } from 'aix'

function Chat() {
  const aix = useAixRef()

  const onSubmit = () => {
    aix.current?.scrollToIndexWhenBlankSizeReady(messages.length + 1, true)
    requestAnimationFrame(Keyboard.dismiss)
  }

  return <Aix ref={aix}>{/* ... */}</Aix>
}
```

### Add a scroll to end button

You can use `onScrolledNearEndChange` to show a "scroll to end" button when the
user scrolls away from the bottom:

```tsx
import { Aix, useAixRef } from 'aix'
import { useState } from 'react'
import { Button } from 'react-native'

function Chat() {
  const aix = useAixRef()
  const [isNearEnd, setIsNearEnd] = useState(false)

  return (
    <Aix
      ref={aix}
      scrollEndReachedThreshold={200}
      onScrolledNearEndChange={setIsNearEnd}
    >
      {/* ScrollView and messages... */}

      {!isNearEnd && (
        <Button
          onPress={() => aix.current?.scrollToEnd(true)}
          title='Scroll to end'
        />
      )}
    </Aix>
  )
}
```

## API Reference

### `Aix`

The main container component that provides keyboard-aware behavior and manages
scrolling for chat interfaces.

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
aix.current?.scrollToIndexWhenBlankSizeReady(
  index,
  animated,
  waitForKeyboardToEnd
)
```

| Method                            | Parameters                                                          | Description                                                                |
| --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `scrollToEnd`                     | `animated?: boolean`                                                | Scrolls to the end of the content.                                         |
| `scrollToIndexWhenBlankSizeReady` | `index: number, animated?: boolean, waitForKeyboardToEnd?: boolean` | Scrolls to a specific cell index once the blank size calculation is ready. |

---

### `AixCell`

A wrapper component for each message in the list. It communicates cell position
and dimensions to the parent `Aix` component.

#### Props

| Prop     | Type      | Required | Description                                                                                 |
| -------- | --------- | -------- | ------------------------------------------------------------------------------------------- |
| `index`  | `number`  | Yes      | The index of this cell in the message list.                                                 |
| `isLast` | `boolean` | Yes      | Whether this cell is the last item in the list. Used for scroll positioning and animations. |

---

### `AixFooter`

A footer component for floating composers that allows content to scroll
underneath it. The footer's height is automatically tracked for proper scroll
offset calculations.

#### Props

Accepts all standard React Native `View` props.

#### Important Notes

- **Do not apply vertical padding** (`padding`, `paddingBottom`) directly to
  `AixFooter`. Apply padding to a child view instead.
- Position the footer absolutely at the bottom of the `Aix` container:

```tsx
<AixFooter style={{ position: 'absolute', inset: 0, top: 'auto' }}>
  <Composer />
</AixFooter>
```

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

## TODOs

- [ ] Android support
- [ ] LegendList support
- [ ] FlashList support

## Requirements

- React Native v0.78.0 or higher
- Node 18.0.0 or higher
