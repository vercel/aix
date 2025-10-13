import { AnimatedLegendList } from '@legendapp/list/reanimated'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'

import {
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
import { Text, View } from 'react-native'
import { ListProvider } from './ListProvider'
import { useEffect, useState } from 'react'

export default function App() {
  const [messages, setMessages] = useState<
    { type: 'user' | 'system'; content: string }[]
  >([{ type: 'user', content: 'Hello' }])

  useEffect(() => {
    setTimeout(() => {
      setMessages([...messages, { type: 'system', content: 'How are you?' }])
    }, 1000)
  }, [])

  return (
    <ListProvider initialComposerHeight={0}>
      <View style={{ height: 60, backgroundColor: 'blue' }} />
      <ListContainer
        length={messages.length}
        style={({ ready }) => {
          'worklet'
          return { opacity: withTiming(ready ? 1 : 0, { duration: 150 }) }
        }}
      >
        <List
          data={messages}
          renderItem={({ item, index }) => {
            if (item.type === 'user') {
              // return <Text>{item.content}</Text>
              return <UserMessage message={item.content} messageIndex={index} />
            }
            return <SystemMessage message={item.content} messageIndex={index} />
          }}
          keyExtractor={(item, index) => `${item.type}-${index}`}
        />
      </ListContainer>
    </ListProvider>
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
    ready: hasScrolledToEnd,
    styleWorklet,
  })
  return (
    <Animated.View {...containerProps} style={[{ flex: 1 }, containerStyle]}>
      {children}
    </Animated.View>
  )
}

function List<Data>(
  parentProps: React.ComponentPropsWithRef<typeof AnimatedLegendList<Data>>
) {
  const numMessages = parentProps.data?.length ?? 0
  const props = useMessageListProps({ bottomInsetPadding: 0 })

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
  const content = <Text>{message}</Text>

  // return content

  if (messageIndex === 0) {
    return <FirstUserMessageFrame>{content}</FirstUserMessageFrame>
  }
  return content
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
    messageMinimumHeight: 20,
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
    messageMinimumHeight: 20,
    bottomInset: 0,
  })
  return (
    <Animated.View ref={refToMeasure} onLayout={onLayout}>
      <Text>{message}</Text>
    </Animated.View>
  )
}
