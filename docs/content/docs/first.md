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
  useScrollOnComposerUpdate,
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

  useScrollOnComposerUpdate()
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
      keyExtractor={(item) => item.id}
      {...props}
    />
  )
}
```

If you want to add an optimistic placeholder, you could do it here, or in the
parent:

```tsx
let messages = props.messages

if (isPending) {
  messages = [...messages, { id: 'optimistic', type: 'placeholder' }]
}

// in renderItem
if (item.type === 'placeholder') {
  return <PlaceholderMessage />
}
```

A common pattern is to show a thinking state optimistically.

### `UserMessage`

```tsx
import { useFirstMessageAnimation } from 'aix'
import Animated from 'react-native-reanimated'
import { UserMessageContent } from 'path/to/your/user-message-content'

export function UserMessage({ message, messageIndex, isNewChat }) {
  // almost every app should use this logic
  // unless you're doing something special
  const shouldAnimateIn = isNewChat && messageIndex === 0

  if (shouldAnimateIn) {
    return (
      <FirstUserMessageFrame>
        <UserMessageContent />
      </FirstUserMessageFrame>
    )
  }

  return <UserMessageContent />
}

function FirstUserMessageFrame({ children }) {
  const { style, ref, onLayout } = useFirstMessageAnimation({
    disabled: false,
  })

  return (
    <Animated.View style={style} ref={ref} onLayout={onLayout}>
      {children}
    </Animated.View>
  )
}
```

#### `useFirstMessageAnimation`

As a performance optimization, we conditionally render the
`FirstUserMessageFrame` in the example above. This way, we only render the
animated node and hooks if they're used.

However, if for some reason you need to mount the `useFirstMessageAnimation`
hook, you can rely on the `disabled` prop rather than the conditional rendering.

```tsx
import { useFirstMessageAnimation } from 'aix'
import Animated from 'react-native-reanimated'
import { UserMessageContent } from 'path/to/your/user-message-content'

function UserMessage({ message, messageIndex, isNewChat }) {
  const shouldAnimateIn = isNewChat && messageIndex === 0
  const { style, ref, onLayout } = useFirstMessageAnimation({
    disabled: !shouldAnimateIn,
  })

  return (
    <Animated.View style={style} ref={ref} onLayout={onLayout}>
      <UserMessageContent />
    </Animated.View>
  )
}
```

We conditionally apply these animations because they only apply for the first
message in new chats. All subsequent messages will rely on an implementation of
`scrollToEnd({ animated: true })` instead of this animation.

Most apps will rely on `isNewChat && messageIndex === 0` to determine if the
message should be animated in. However, if you are doing something special, such
as rendering custom items in your LegendList above the actual messages, you can
tweak the logic to fit your app.

In the future, `aix` will provide more granular customization of the animation
itself. For now, it provides an `opacity` + `translateY` entrance animation
based on the message's size.

### `SystemMessage`

### `Composer`

`aix` is built to support a "floating composer". This lets you use UIs like
Liquid Glass and progressive blurs in your composer as users scroll.

In order to support this behavior, you need to do 2 things.

#### Build your own composer

First, build your own composer. It should register its height with `aix` using
the `useComposerHeightContext` hook. `useSyncLayoutHandler` is a convenience
hook to measure synchronously.

```tsx
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { useComposerHeightContext, useSyncLayoutHandler } from 'aix'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function Composer() {
  const { composerHeight } = useComposerHeightContext()
  const { onLayout, ref } = useSyncLayoutHandler((layout) => {
    composerHeight.set(layout.height)
  })

  const { bottom } = useSafeAreaInsets()

  return (
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      ref={ref}
      onLayout={onLayout}
    >
      <KeyboardStickyView offset={{ opened: 0, closed: -bottom }}>
        <ComposerContent />
      </KeyboardStickyView>
    </View>
  )
}
```

`KeybaordStickyView` from `react-native-keyboard-controller` ensures that your
composer content reacts to the keyboard size.

Notice that the composer is absolutely-positioned to the bottom of the screen.

#### Enable autoscrolling

In order to enable autoscrolling, call `useScrollOnComposerUpdate()` in your
`MessagesList` component. If you follow the docs for
[MessagesList](#messageslist), above, you will already have this. As the name
implies, this hook ensures that, whenever you type a new line, the list will
scroll if you are at the bottom of the chat.
