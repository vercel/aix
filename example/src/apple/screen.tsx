import { AnimatedLegendList } from '@legendapp/list/reanimated'
import Animated, {
  interpolate,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'

import {
  useMessageListContainerProps,
  useMessageListProps,
  useScrollOnComposerUpdate,
  useKeyboardAwareMessageList,
  useMessageListContainerStyle,
  useMessageListInitialScrollToEnd,
  useSetLastAnimatableMessage,
  useFirstMessageAnimation,
  useMessageBlankSize,
  useChatAnimation,
  useSyncLayoutHandler,
} from 'ai-chat'
import { useFirstMessageEntrance } from 'ai-chat/chat/message-list/item/use-first-message-entrance'
import { Button, Keyboard, Text, TextInput, View } from 'react-native'
import { ChatProvider } from '../../ListProvider'
import { useState } from 'react'
import {
  useReanimatedKeyboardAnimation,
  KeyboardProvider,
} from 'react-native-keyboard-controller'
import { useComposerHeightContext } from 'ai-chat/chat/composer/composer-height-context'
import { useKeyboardContextState } from 'ai-chat/chat/keyboard/provider'
import { useIsLastItem } from '@legendapp/list'
import { useAppleChat } from './use-apple'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { Debugger } from 'ai-chat/debugger'

export default function App() {
  const chatId = '1'

  let { messages, submit } = useAppleChat()

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <ChatProvider chatId={chatId}>
            <View style={{ flex: 1, paddingTop: 60 }}>
              {messages.length > 0 && <List data={messages} />}
            </View>
            <Composer onSend={submit} />
            <Debugger />
          </ChatProvider>
        </View>
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}

type Message = { role: 'user' | 'assistant'; content: string }

function ListContainer({ children }: { children: React.ReactNode }) {
  const containerProps = useMessageListContainerProps()
  const hasScrolledToEnd = useMessageListInitialScrollToEnd()
  const containerStyle = useMessageListContainerStyle({
    ready: hasScrolledToEnd,
    styleWorklet: ({ ready }) => {
      'worklet'
      return {
        opacity: withTiming(ready ? 1 : 0, { duration: 200 }),
      }
    },
  })
  return (
    <Animated.View {...containerProps} style={[{ flex: 1 }, containerStyle]}>
      {children}
    </Animated.View>
  )
}

function Composer({ onSend }: { onSend: (message: string) => void }) {
  const defaultText = 'Hi'
  const [text, setText] = useState(defaultText)
  const { composerHeight } = useComposerHeightContext()
  const { onLayout, ref } = useSyncLayoutHandler((layout) => {
    composerHeight.set(layout.height)
  })
  const { setIsMessageSendAnimating } = useChatAnimation()
  const { setKeyboardState, shouldOffsetCloseKeyboard } =
    useKeyboardContextState()

  const bottomInset = useBottomInset()
  return (
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      ref={ref}
      onLayout={onLayout}
    >
      <StickyView offset={{ opened: -8, closed: -bottomInset }}>
        <View
          style={{
            paddingHorizontal: 16,
            flexDirection: 'row',
          }}
        >
          <TextInput
            style={{
              padding: 12,
              backgroundColor: '#222',
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingHorizontal: 16,
              color: 'white',
              flex: 1,
            }}
            onChangeText={setText}
            value={text}
            multiline
          />
          <Button
            title='Add'
            onPress={() => {
              onSend(text)
              setText('')

              // this is horrifying, fix it
              setKeyboardState('didHide')
              shouldOffsetCloseKeyboard.set(false)
              setIsMessageSendAnimating(true)

              Keyboard.dismiss()
            }}
          />
        </View>
      </StickyView>
    </View>
  )
}

function StickyView(
  props: React.ComponentProps<typeof Animated.View> & {
    offset?: { opened?: number; closed?: number }
  }
) {
  const { height, progress } = useReanimatedKeyboardAnimation()

  const style = useAnimatedStyle(() => {
    const y =
      height.get() +
      interpolate(
        progress.get(),
        [0, 1],
        [props.offset?.closed ?? 0, props.offset?.opened ?? 0]
      )
    return {
      transform: [
        {
          translateY: y,
        },
      ],
    }
  })

  return <Animated.View {...props} style={[style, props.style]} />
}

function useBottomInset() {
  return useSafeAreaInsets().bottom
}

const chatPaddingBottom = 16

function List({ data }: { data: Message[] }) {
  const isNewChat = true
  const numMessages = data?.length ?? 0
  const bottomInset = useBottomInset()

  useKeyboardAwareMessageList({
    numMessages,
    lastUserMessageIndex: data.findLastIndex((item) => item.role === 'user'),
    bottomInset,
    chatPaddingBottom,
  })
  useScrollOnComposerUpdate()
  const props = useMessageListProps({ bottomInsetPadding: 12 })

  let messages = data
  if (messages.at(-1)?.role === 'user') {
    messages = [...messages, { role: 'assistant', content: 'Thinking...' }]
  }

  return (
    <ListContainer>
      <AnimatedLegendList
        keyboardDismissMode='interactive'
        data={messages}
        renderItem={({ item, index }) => {
          if (item.role === 'user') {
            return (
              <UserMessage
                message={item.content}
                messageIndex={index}
                isNewChat={isNewChat}
              />
            )
          }

          return (
            <SystemMessage
              message={item.content}
              messageIndex={index}
              isNewChat={isNewChat}
            />
          )
        }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: chatPaddingBottom,
        }}
        keyExtractor={(item, index) => `${item.role}-${index}`}
        {...props}
      />
    </ListContainer>
  )
}

function UserMessage({
  message,
  messageIndex,
  isNewChat,
}: {
  message: string
  messageIndex: number
  isNewChat: boolean
}) {
  useSetLastAnimatableMessage({ messageIndex })

  return (
    <UserMessageFrame messageIndex={messageIndex} isNewChat={isNewChat}>
      <Text style={{ color: 'white' }}>{message}</Text>
    </UserMessageFrame>
  )
}

function UserMessageFrame({
  children,
  messageIndex,
  isNewChat,
}: {
  children: React.ReactNode
  messageIndex: number
  isNewChat: boolean
}) {
  const { style, ref, onLayout } = useFirstMessageAnimation({
    disabled: messageIndex > 0 || !isNewChat,
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
          marginBottom: 16,
        },
      ]}
      ref={ref}
      onLayout={onLayout}
    >
      {children}
    </Animated.View>
  )
}

function SystemMessageAnimatedFrame({
  children,
  messageIndex,
  isNewChat,
}: {
  children: React.ReactNode
  messageIndex: number
  isNewChat: boolean
}) {
  const isLast = useIsLastItem()
  const bottomInset = useBottomInset()
  const { onLayout, refToMeasure, renderedSize } = useMessageBlankSize({
    messageIndex,
    messageMinimumHeight: 20,
    bottomInset,
    isLastMessage: isLast,
  })
  const { isComplete } = useFirstMessageEntrance({
    itemHeight: renderedSize,
    disabled: messageIndex !== 1 || !isNewChat,
  })

  const style = useAnimatedStyle(() => ({
    // show once the user message has animated in
    // TODO this needs to be more "abstractable"
    opacity: isComplete.get() ? withTiming(1, { duration: 350 }) : 0,
  }))

  return (
    <Animated.View
      style={[style, { paddingBottom: 16 }]}
      ref={refToMeasure}
      onLayout={onLayout}
    >
      {children}
    </Animated.View>
  )
}

function SystemMessage({
  message,
  messageIndex,
  isNewChat,
}: {
  message: string
  messageIndex: number
  isNewChat: boolean
}) {
  return (
    <SystemMessageAnimatedFrame
      messageIndex={messageIndex}
      isNewChat={isNewChat}
    >
      <Text style={{ color: 'white' }}>{message}</Text>
    </SystemMessageAnimatedFrame>
  )
}
