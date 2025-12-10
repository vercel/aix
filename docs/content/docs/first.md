---
title: Anatomy of a chat
---

Let's build our first chat using `aix`.

At the moment, you might find that there are many hooks and different APIs to
call and be aware of. In the future, we hope to make these APIs less verbose
once the internals are more stable.

### Structure

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

The philosophy here, so far, is closer to that of shadcn than a traditional chat
SDK. We will provide the logic to let you compose your own chat experience. In
the future, we will improve the DX with components you can install with the
shadcn cli.

### `ChatScreen`

Your chat code should end up looking something like this:

```tsx
export function ChatScreen({ chatId }) {
  const messages = useMessages(chatId)

  return (
    <ChatProvider chatId={chatId}>
      {messages.length > 0 && (
        <MessagesListContainer>
          <MessagesList />
        </MessagesListContainer>
      )}
      <Composer />
    </ChatProvider>
  )
}
```

Let's implement each internal part.

### `ChatProvider`

As the name suggests, the `ChatProvider` has to live at the root. You can choose
to split this up however you want, but the order of the providers is important.

```tsx
import {
  MessageListContextProvider,
  ComposerHeightContextProvider,
  ChatAnimationProvider,
  KeyboardStateProvider,
} from 'aix'
import { KeyboardProvider } from 'react-native-keyboard-controller'

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

// you could render this provider at the root of your app
// but for this example, we render it in ChatProvider
export function KeyboardProviders({ children }) {
  return (
    <KeyboardProvider>
      <KeyboardStateProvider>{children}</KeyboardStateProvider>
    </KeyboardProvider>
  )
}
```

There are a few key details to note here:

- `KeyboardProvider` from `react-native-keyboard-controller` can go at the root
  of the app
- `KeyboardStateProvider` from `aix` can also go at the root of the app if
  desired, as its state is not chat-specific
- The remaining providers, `ComposerHeightContextProvider`,
  `MessageListContextProvider`, `ChatAnimationProvider` are chat-specific
- For chat-specific providers, we use a `key` prop to ensure that the state is
  reset when the chat ID changes.
  - This ID should correspond to the unique identifier you use for your chat in
    the database.

### `MessagesListContainer`

```tsx
<MessagesListContainer>
  <MessagesList />
</MessagesListContainer>
```

The `MessageListContainer` is responsible for:

- Measuring the size of the height of the chat container
- Fading in the content once it's initially scrolled to the end

```tsx
import {
  useMessageListContainerProps,
  useMessageListInitialScrollToEnd,
  useMessageListContainerStyle,
} from 'aix'
import Animated, { withTiming } from 'react-native-reanimated'

function ListContainer({ children }: { children: React.ReactNode }) {
  const containerProps = useMessageListContainerProps()
  const hasScrolledToEnd = useMessageListInitialScrollToEnd()
  const containerStyle = useMessageListContainerStyle({
    ready: hasScrolledToEnd,
    styleWorklet: ({ ready }) => ({
      opacity: withTiming(ready ? 1 : 0, { duration: 150 }),
    }),
  })
  return (
    <Animated.View
      onLayout={containerProps.onLayout}
      ref={containerProps.ref}
      style={[{ flex: 1 }, containerStyle]}
    >
      {children}
    </Animated.View>
  )
}
```

Notice we render 3 hooks:

- `useMessageListContainerProps` - is responsible for measuring the size of the
  container.
- `useMessageListInitialScrollToEnd` handles scrolling the chat initially.
- `useMessageListContainerStyle` lets you animate the content in once the
  content is scrolled to the end. It's a convenience wrapper around
  `useAnimatedStyle`.

### `MessagesList`

```tsx
<MessagesList />
```

`MessagesList` renders an animated `LegendList` component.

For now, `aix` provides a number of hooks to help you build your own
`MessagesList` component.

```tsx
import {
  useKeyboardAwareMessageList,
  useScrollMessageListFromComposerSizeUpdates,
  useUpdateLastMessageIndex,
  useMessageListProps,
} from 'aix'
import { AnimatedLegendList } from '@legendapp/list/reanimated'

function List({ messages, isNewChat }) {
  const numMessages = messages.length
  const lastUserMessageIndex = messages.findLastIndex(
    (item) => item.type === 'user'
  )

  useKeyboardAwareMessageList({
    numMessages,
    lastUserMessageIndex,
  })

  useScrollMessageListFromComposerSizeUpdates()
  useUpdateLastMessageIndex({ numMessages })
  const props = useMessageListProps({ bottomInsetPadding })

  return (
    <AnimatedLegendList
      keyboardDismissMode='interactive'
      renderItem={({ item, index }) => {
        if (item.type === 'user') {
          return <UserMessage message={item.content} messageIndex={index} />
        }
        return <SystemMessage message={item.content} messageIndex={index} />
      }}
      {...props}
    />
  )
}
```
