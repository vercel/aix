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
  useMessageListContext,
  useChatAnimation,
  useSyncLayoutHandler,
} from 'ai-chat'
import { useFirstMessageEntrance } from 'ai-chat/chat/message-list/item/use-first-message-entrance'
import { Button, Keyboard, Text, TextInput, View } from 'react-native'
import { ChatProvider } from './ListProvider'
import { useState } from 'react'
import {
  useReanimatedKeyboardAnimation,
  KeyboardProvider,
} from 'react-native-keyboard-controller'
import { useComposerHeightContext } from 'ai-chat/chat/composer/composer-height-context'
import { useKeyboardContextState } from 'ai-chat/chat/keyboard/provider'
import { useIsLastItem } from '@legendapp/list'
import { useAppleChat } from './src/use-apple-chat'
import {
  useSafeAreaInsets,
  SafeAreaProvider,
} from 'react-native-safe-area-context'

const bottomInsetPadding = 12

export default function App() {
  let { messages, submit } = useAppleChat()
  const chatId = '1'

  if (messages.at(-1)?.role === 'user') {
    messages = [...messages, { role: 'assistant', content: 'Thinking...' }]
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <ChatProvider chatId={chatId}>
            <Wrapper>
              {messages.length > 0 && (
                <ListContainer>
                  <List data={messages} />
                </ListContainer>
              )}
            </Wrapper>
            <Composer onSend={submit} />
          </ChatProvider>
        </View>
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const top = useSafeAreaInsets().top
  return (
    <View
      style={{
        flex: 1,
        marginTop: top,
        borderTopColor: '#111111',
        borderTopWidth: 1,
      }}
    >
      {children}
    </View>
  )
}

function Actions() {
  return (
    <View
      style={{
        height: 40,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
      }}
    >
      <ScrollToEndButton />
    </View>
  )
}

type Message = { role: 'user' | 'assistant'; content: string }

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

  const bottomInset = useSafeAreaInsets().bottom

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      collapsable={false}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
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

function List({ data }: { data: Message[] }) {
  const chatPaddingBottom = 16
  const isNewChat = true
  const numMessages = data?.length ?? 0
  const bottomInset = useSafeAreaInsets().bottom

  useKeyboardAwareMessageList({
    numMessages,
    lastUserMessageIndex: data.findLastIndex((item) => item.role === 'user'),
    chatPaddingBottom,
    bottomInset,
  })
  useScrollOnComposerUpdate()
  const props = useMessageListProps({ bottomInsetPadding })

  const initialScrollIndex = data.length > 2 ? data.length - 1 : undefined

  return (
    <AnimatedLegendList
      keyboardDismissMode='interactive'
      initialScrollIndex={initialScrollIndex}
      data={data}
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
          <AssistantMessage
            message={item.content}
            messageIndex={index}
            isNewChat={isNewChat}
          />
        )
      }}
      keyExtractor={(item, index) => `${item.role}-${index}`}
      contentContainerStyle={{
        paddingBottom: chatPaddingBottom,
        paddingHorizontal: 16,
      }}
      {...props}
    />
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
    <FirstUserMessageFrame messageIndex={messageIndex} isNewChat={isNewChat}>
      <Text style={{ color: 'white' }}>{message}</Text>
    </FirstUserMessageFrame>
  )
}

function FirstUserMessageFrame({
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
        },
      ]}
      ref={ref}
      onLayout={onLayout}
    >
      {children}
    </Animated.View>
  )
}

function AssistantMessageAnimatedFrame({
  children,
  messageIndex,
  isNewChat,
}: {
  children: React.ReactNode
  messageIndex: number
  isNewChat: boolean
}) {
  const isLast = useIsLastItem()
  const bottomInset = useSafeAreaInsets().bottom
  const { onLayout, refToMeasure, renderedSize } = useMessageBlankSize({
    messageIndex,
    messageMinimumHeight: 41,
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
    <Animated.View style={style} ref={refToMeasure} onLayout={onLayout}>
      {children}
    </Animated.View>
  )
}

function AssistantMessage({
  message,
  messageIndex,
  isNewChat,
}: {
  message: string
  messageIndex: number
  isNewChat: boolean
}) {
  return (
    <AssistantMessageAnimatedFrame
      messageIndex={messageIndex}
      isNewChat={isNewChat}
    >
      <Text style={{ color: 'white' }}>{message}</Text>
    </AssistantMessageAnimatedFrame>
  )
}
