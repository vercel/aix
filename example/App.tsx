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
} from 'ai-chat'
import { useMessageListContext } from 'ai-chat/chat/message-list/context'

export default function App() {
  return (
    <ChatAnimationProvider>
      <ComposerHeightContextProvider initialHeight={100}>
        <KeyboardStateProvider>
          <MessageListContextProvider>
            <ListMonolith />
          </MessageListContextProvider>
        </KeyboardStateProvider>
      </ComposerHeightContextProvider>
    </ChatAnimationProvider>
  )
}

function ListSplit() {
  const messages = [1]
  const numMessages = messages.length
  return (
    <ContainerView numMessages={numMessages}>
      <ListView data={messages} />
    </ContainerView>
  )
}

function ListMonolith() {
  const messages = []
  const numMessages = messages.length
  const containerProps = useMessageListContainerProps()
  const props = useMessageListProps()

  useKeyboardAwareMessageList({
    numMessages,
  })
  useStartedWithOneMessage({ numMessages })
  useUpdateLastMessageIndex({ numMessages })
  useScrollMessageListFromComposerSizeUpdates()

  const hasScrolledToEnd = useMessageListInitialScrollToEnd({ numMessages })
  const containerStyle = useMessageListContainerStyle({
    hasScrolledToEnd,
    styleWorklet: ({ ready }) => {
      'worklet'
      return {
        opacity: withTiming(ready ? 1 : 0, { duration: 150 }),
      }
    },
  })

  return (
    <Animated.View {...containerProps} style={[{ flex: 1 }, containerStyle]}>
      <AnimatedLegendList {...props} />
    </Animated.View>
  )
}

function ContainerView({
  children,
  numMessages,
}: {
  children: React.ReactNode
  numMessages: number
}) {
  const containerProps = useMessageListContainerProps()
  const hasScrolledToEnd = useMessageListInitialScrollToEnd({ numMessages })
  const containerStyle = useMessageListContainerStyle({
    hasScrolledToEnd,
    styleWorklet: ({ ready }) => {
      'worklet'
      return { opacity: withTiming(ready ? 1 : 0, { duration: 150 }) }
    },
  })
  return (
    <Animated.View {...containerProps} style={[{ flex: 1 }, containerStyle]}>
      {children}
    </Animated.View>
  )
}

function ListView(
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
