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
import { Aix, AixCell } from 'aix';
import { Message } from 'path/to/your/message';
import { Composer } from 'path/to/your/composer';

export function ChatScreen({ messages }) {
  return (
    <Aix style={{ flex: 1 }}>
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
  );
}
```

To add a floating composer which lets content scroll under it, you can use the `AixFooter` and `KeyboardStickyView` from `react-native-keyboard-controller`:

```tsx
import { Aix, AixCell, AixFooter } from 'aix';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

export function ChatScreen({ messages }) {
  return (
    <Aix style={{ flex: 1 }}>
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

      <KeyboardStickyView offset={{ opened: 0, closed: -bottomInsetPadding }}>
        <AixFooter style={{ position: 'absolute', inset: 0, top: 'auto'}}>
          <Composer />
        </AixFooter>
      </KeyboardStickyView>
    </Aix>
  );
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

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shouldStartAtEnd` | `boolean` | - | Whether the scroll view should start scrolled to the end of the content. |
| `scrollOnFooterSizeUpdate` | `object` | `{ enabled: true, scrolledToEndThreshold: 100, animated: false }` | Control the behavior of scrolling when the footer size changes. By default, changing the height of the footer will shift content up in the scroll view. |
| `scrollEndReachedThreshold` | `number` | `max(blankSize, 200)` | The number of pixels from the bottom of the scroll view to the end of the content that is considered "near the end". Used by `onScrolledNearEndChange` and to determine if content should shift up when keyboard opens. |
| `onScrolledNearEndChange` | `(isNearEnd: boolean) => void` | - | Callback fired when the scroll position transitions between "near end" and "not near end" states. Reactive to user scrolling, content size changes, parent size changes, and keyboard height changes. Uses `scrollEndReachedThreshold` to determine the threshold. |
| `additionalContentInsets` | `object` | - | Additional content insets applied when keyboard is open or closed. Shape: `{ top?: { whenKeyboardOpen, whenKeyboardClosed }, bottom?: { whenKeyboardOpen, whenKeyboardClosed } }` |
| `additionalScrollIndicatorInsets` | `object` | - | Additional insets for the scroll indicator, added to existing safe area insets. Applied to `verticalScrollIndicatorInsets` on iOS. |
| `mainScrollViewID` | `string` | - | The `nativeID` of the scroll view to use. If provided, will search for a scroll view with this `accessibilityIdentifier`. |
| `penultimateCellIndex` | `number` | - | The index of the second-to-last message (typically the last user message in AI chat apps). Used to determine which message will be scrolled into view. Useful when you have custom message types like timestamps in your list. |

#### Ref Methods

Access these methods via `useAixRef()`:

```tsx
const aix = useAixRef();

// Scroll to the end of the content
aix.current?.scrollToEnd(animated);

// Scroll to a specific index when the blank size is ready
aix.current?.scrollToIndexWhenBlankSizeReady(index, animated, waitForKeyboardToEnd);
```

| Method | Parameters | Description |
|--------|------------|-------------|
| `scrollToEnd` | `animated?: boolean` | Scrolls to the end of the content. |
| `scrollToIndexWhenBlankSizeReady` | `index: number, animated?: boolean, waitForKeyboardToEnd?: boolean` | Scrolls to a specific cell index once the blank size calculation is ready. |

---

### `AixCell`

A wrapper component for each message in the list. It communicates cell position and dimensions to the parent `Aix` component.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `number` | Yes | The index of this cell in the message list. |
| `isLast` | `boolean` | Yes | Whether this cell is the last item in the list. Used for scroll positioning and animations. |

---

### `AixFooter`

A footer component for floating composers that allows content to scroll underneath it. The footer's height is automatically tracked for proper scroll offset calculations.

#### Props

Accepts all standard React Native `View` props.

#### Important Notes

- **Do not apply vertical padding** (`padding`, `paddingBottom`) directly to `AixFooter`. Apply padding to a child view instead.
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
import { useAixRef } from 'aix';

function Chat({ messages }) {
  const aix = useAixRef();
  const send = useSendMessage()
  
  const handleSend = () => {
    // Scroll to end after sending a message
    send(message);
    aix.current?.scrollToIndexWhenBlankSizeReady(messages.length + 1, true);
    requestAnimationFrame(Keyboard.dismiss);
  };
  
  return <Aix ref={aix}>{/* ... */}</Aix>;
}
```

---

### Scroll to End Button

You can use `onScrolledNearEndChange` to show a "scroll to end" button when the user scrolls away from the bottom:

```tsx
import { Aix, useAixRef } from 'aix';
import { useState } from 'react';

function Chat() {
  const aix = useAixRef();
  const [isNearEnd, setIsNearEnd] = useState(false);

  return (
    <Aix
      ref={aix}
      scrollEndReachedThreshold={200}
      onScrolledNearEndChange={setIsNearEnd}
    >
      {/* ScrollView and messages... */}

      {!isNearEnd && (
        <Button onPress={() => aix.current?.scrollToEnd(true)} />
      )}
    </Aix>
  );
}
```

## TODOs


## Requirements

- React Native v0.78.0 or higher
- Node 18.0.0 or higher