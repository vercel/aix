import { AnimatedLegendList } from '@legendapp/list/reanimated'
import Animated, { withTiming } from 'react-native-reanimated'

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
} from 'ai-chat'

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
  return null
}
