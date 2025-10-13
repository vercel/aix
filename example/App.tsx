import { AnimatedLegendList } from '@legendapp/list/reanimated'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'

import {
  ChatAnimationProvider,
  KeyboardStateProvider,
  ComposerHeightContextProvider,
  MessageListContextProvider,
  useMessageListContainerProps,
  useMessageListProps,
  useUpdateLastMessageIndex,
  useScrollMessageListFromComposerSizeUpdates,
  useKeyboardAwareMessageList,
  useStartedWithOneMessage,
  useMessageListContainerStyle,
  useMessageListInitialScrollToEnd,
  useSetLastAnimatableMessage,
  useFirstMessageAnimation,
  useMessageBlankSize,
} from 'ai-chat'
import { useFirstMessageEntrance } from 'ai-chat/chat/message-list/item/use-first-message-entrance'

export default function App() {
  const messages = [
    { type: 'user', content: 'Hello' },
    { type: 'system', content: 'How are you?' },
  ]
  return (
    <ListProvider initialComposerHeight={100}>
      <ListContainer
        length={messages.length}
        style={({ ready }) => {
          'worklet'
          return { opacity: withTiming(ready ? 1 : 0, { duration: 150 }) }
        }}
      >
        <List data={messages} />
      </ListContainer>
    </ListProvider>
  )
}

function ListProvider({
  children,
  initialComposerHeight,
}: {
  children: React.ReactNode
  initialComposerHeight: number
}) {
  return (
    <MessageListContextProvider>
      <ChatAnimationProvider>
        <ComposerHeightContextProvider initialHeight={initialComposerHeight}>
          <KeyboardStateProvider>{children}</KeyboardStateProvider>
        </ComposerHeightContextProvider>
      </ChatAnimationProvider>
    </MessageListContextProvider>
  )
}

function ListContainer({
  children,
  length: numMessages,
  style: styleWorklet,
}: {
  children: React.ReactNode
  length: number
  style: Parameters<typeof useMessageListContainerStyle>[0]['styleWorklet']
}) {
  const containerProps = useMessageListContainerProps()
  const hasScrolledToEnd = useMessageListInitialScrollToEnd({ numMessages })
  const containerStyle = useMessageListContainerStyle({
    hasScrolledToEnd,
    styleWorklet,
  })
  return (
    <Animated.View {...containerProps} style={[{ flex: 1 }, containerStyle]}>
      {children}
    </Animated.View>
  )
}

function List(
  parentProps: React.ComponentPropsWithRef<typeof AnimatedLegendList>
) {
  const numMessages = parentProps.data?.length ?? 0
  const props = useMessageListProps()

  useKeyboardAwareMessageList({
    numMessages,
  })
  useStartedWithOneMessage({ numMessages })
  useUpdateLastMessageIndex({ numMessages })
  useScrollMessageListFromComposerSizeUpdates()

  return <AnimatedLegendList {...parentProps} {...props} />
}

function UserMessage({
  message,
  messageIndex,
}: {
  message: string
  messageIndex: number
}) {
  useSetLastAnimatableMessage({ messageIndex })
  const content = <></>

  if (messageIndex === 0) {
    return <FirstUserMessageFrame>{content}</FirstUserMessageFrame>
  }
  return null
}

function FirstUserMessageFrame({ children }: { children: React.ReactNode }) {
  const { style, ref, onLayout } = useFirstMessageAnimation()

  return (
    <Animated.View style={style} ref={ref} onLayout={onLayout}>
      {children}
    </Animated.View>
  )
}

function FirstSystemMessagePlaceholder({
  messageIndex,
  children,
}: {
  messageIndex: number
  children: React.ReactNode
}) {
  const { onLayout, refToMeasure, renderedSize } = useMessageBlankSize({
    messageIndex,
    messageMinimumHeight: 0,
    bottomInset: 0,
  })

  const { translateY } = useFirstMessageEntrance({
    itemHeight: renderedSize,
  })

  const style = useAnimatedStyle(() => ({
    // show once the user message has animated in
    // TODO this needs to be more "abstractable"
    opacity: translateY.get() === 0 ? withTiming(1, { duration: 350 }) : 0,
  }))

  return (
    <Animated.View style={style} ref={refToMeasure} onLayout={onLayout}>
      {children}
    </Animated.View>
  )
}

function SystemMessagePlaceholder({
  messageIndex,
  children,
}: {
  messageIndex: number
  children: React.ReactNode
}) {
  if (messageIndex === 1) {
    return (
      <FirstSystemMessagePlaceholder messageIndex={messageIndex}>
        {children}
      </FirstSystemMessagePlaceholder>
    )
  }
  return null
}

function SystemMessage({
  message,
  messageIndex,
}: {
  message: string
  messageIndex: number
}) {
  const { onLayout, refToMeasure } = useMessageBlankSize({
    messageIndex,
    messageMinimumHeight: 0,
    bottomInset: 0,
  })
  return (
    <Animated.View ref={refToMeasure} onLayout={onLayout}>
      {message}
    </Animated.View>
  )
}
