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
  useMessageListContext,
  useChatAnimation,
} from 'ai-chat'
import { useFirstMessageEntrance } from 'ai-chat/chat/message-list/item/use-first-message-entrance'
import { Button, Text, View } from 'react-native'
import { ListProvider } from './ListProvider'
import { createContext, use, useEffect, useState } from 'react'

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])

  return (
    <ListProvider initialComposerHeight={0}>
      <MessagesContext value={[messages, setMessages]}>
        <View style={{ height: 60 }} />
        {messages.length > 0 && (
          <ListContainer
            length={messages.length}
            style={({ ready }) => {
              'worklet'
              return { opacity: withTiming(ready ? 1 : 0, { duration: 200 }) }
            }}
          >
            <List
              data={messages}
              renderItem={({ item, index }) => {
                if (item.type === 'user') {
                  return (
                    <UserMessage message={item.content} messageIndex={index} />
                  )
                }
                return (
                  <SystemMessage message={item.content} messageIndex={index} />
                )
              }}
              keyExtractor={(item, index) => `${item.type}-${index}`}
            />
          </ListContainer>
        )}
        <Composer />
      </MessagesContext>
    </ListProvider>
  )
}

function Composer() {
  const [messages, setMessages] = use(MessagesContext)
  const { setIsMessageSendAnimating } = useChatAnimation()
  return (
    <View
      style={{
        height: 60,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Button
        title='Add'
        onPress={() => {
          setIsMessageSendAnimating(true)
          setMessages((m) => [...m, { type: 'user', content: 'Hello' }])
          setTimeout(() => {
            setIsMessageSendAnimating(false)
            setMessages((messages) => [
              ...messages,
              { type: 'system', content: 'How are you?' },
            ])
          }, 1000)
        }}
      />
      <Button
        title='Clear'
        onPress={() => {
          setMessages([])
        }}
      />
      <ScrollToEndButton />
    </View>
  )
}

type Message = { type: 'user' | 'system'; content: string }

const MessagesContext = createContext<
  [
    messages: Message[],
    setMessages: (
      messages: Message[] | ((messages: Message[]) => Message[])
    ) => void
  ]
>([[], () => {}])

function ScrollToEndButton() {
  const { scrollToEnd } = useMessageListContext()
  return (
    <Button
      title='Scroll to end'
      onPress={() => {
        scrollToEnd()
      }}
    />
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
  parentProps: Omit<
    React.ComponentPropsWithRef<typeof AnimatedLegendList<Data>>,
    keyof ReturnType<typeof useMessageListProps>
  >
) {
  const numMessages = parentProps.data?.length ?? 0

  useStartedWithOneMessage({ didStartWithOneMessage: true })
  useKeyboardAwareMessageList({
    numMessages,
  })
  useScrollMessageListFromComposerSizeUpdates()
  useUpdateLastMessageIndex({ numMessages })
  const props = useMessageListProps({ bottomInsetPadding: 0 })

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

  return (
    <FirstUserMessageFrame messageIndex={messageIndex}>
      {content}
    </FirstUserMessageFrame>
  )
}

function FirstUserMessageFrame({
  children,
  messageIndex,
}: {
  children: React.ReactNode
  messageIndex: number
}) {
  const { style, ref, onLayout } = useFirstMessageAnimation({
    disabled: messageIndex !== 0,
  })

  return (
    <Animated.View
      style={[
        style,
        {
          backgroundColor: '#99999920',
          padding: 12,
          maxWidth: '80%',
          borderRadius: 24,
          alignSelf: 'flex-end',
          margin: 4,
        },
      ]}
      ref={ref}
      onLayout={onLayout}
    >
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
  const { onLayout, refToMeasure, renderedSize } = useMessageBlankSize({
    messageIndex,
    messageMinimumHeight: 20,
    bottomInset: 0,
  })

  const { translateY } = useFirstMessageEntrance({
    itemHeight: renderedSize,
    disabled: messageIndex !== 1,
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
