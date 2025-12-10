---
title: Anatomy of a chat
---

Let's build our first chat using `aix`.

At the moment, you might find that there are many hooks and different APIs to
call and be aware of. In the future, we hope to make these APIs less verbose
once the internals are more stable.

A chat with `aix` has to implement the following:

- `ChatProvider`
- `MessagesListContainer`
  - An `Animated.View` wrapping the `MessagesList`
- `MessagesList`
  - A `LegendList` which renders messages
- `UserMessage`
- `SystemMessage`
- `Composer`

At the moment, these are not components that ship from `aix`. Instead, we
provide the hooks and guides to let you build these yourself, so that you own
more of the code.

Your chat code should end up looking something like this:

```tsx
export function ChatScreen({ chatId }) {
  return (
    <ChatProvider chatId={chatId}>
      <MessagesListContainer>
        <MessagesList />
      </MessagesListContainer>
      <Composer />
    </ChatProvider>
  )
}
```

Let's implement each one.

### `ChatProvider`

As the name suggests, the `ChatProvider` has to live at the root. You can choose
to split this up however, you want, but the order of the providers is important.

```tsx
import {
  MessageListContextProvider,
  ComposerHeightContextProvider,
  ChatAnimationProvider,
  KeyboardStateProvider,
} from 'aix'
import { KeyboardProvider } from 'react-native-keyboard-controller'

// you could render this provider at the root of your app
export function KeyboardProviders({ children }) {
  return (
    <KeyboardProvider>
      <KeyboardStateProvider>{children}</KeyboardStateProvider>
    </KeyboardProvider>
  )
}

export function ChatProvider({ chatId, children }) {
  return (
    <KeyboardProviders>
      <ComposerHeightContextProvider initialHeight={0}>
        <MessageListContextProvider key={chatId}>
          <ChatAnimationProvider>{children}</ChatAnimationProvider>
        </MessageListContextProvider>
      </ComposerHeightContextProvider>
    </KeyboardProviders>
  )
}
```

There are a few key details to note here:

- `KeyboardProvider` from `react-native-keyboard-controller` can go at the root
  of the app
- `KeyboardStateProvider` from `aix` can also go at the root of the app if
  desired, as its state is not chat-specific
- The remaining providers, `ComposerHeightContextProvider`,
  `MessageListContextProvider`, `ChatAnimationProvider` are chat-specific.
- For chat-specific providers, we use a `key` prop to ensure that the state is
  reset when the chat ID changes. This should correspond to the unique
  identifier you use for your chat in the database.

### `MessagesListContainer`
