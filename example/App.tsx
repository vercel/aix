import './src/polyfill'

import { useIsLastItem } from '@legendapp/list'
import { AnimatedLegendList } from '@legendapp/list/reanimated'
import {
  useChatAnimation,
  useFirstMessageAnimation,
  useKeyboardAwareMessageList,
  useMessageBlankSize,
  useMessageListContainerProps,
  useMessageListContainerStyle,
  useMessageListContext,
  useMessageListInitialScrollToEnd,
  useMessageListProps,
  useScrollOnComposerUpdate,
  useSetLastAnimatableMessage,
  useSyncLayoutHandler,
} from 'ai-chat'
import { useComposerHeightContext } from 'ai-chat/chat/composer/composer-height-context'
import { useKeyboardContextState } from 'ai-chat/chat/keyboard/provider'
import { useFirstMessageEntrance } from 'ai-chat/chat/message-list/item/use-first-message-entrance'
import { useRef, useState } from 'react'
import {
  Keyboard,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import {
  KeyboardProvider,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller'
import Animated, {
  interpolate,
  Keyframe,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { ChatProvider } from './ListProvider'
import { useAppleChat, useMessages } from './src/apple'
import { TextFadeInStaggeredIfStreaming } from './src/fade-in'

const safeAreaInsetsBottom = 18
const fontSize = 17
const paddingVertical = 8
const bottomInsetPadding = safeAreaInsetsBottom

type UIMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function App() {
  return (
    <KeyboardProvider>
      <View style={{ flex: 1 }}>
        <ChatProvider chatId='1'>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerText}>Chat</Text>
            </View>
            <Chat />
          </View>
        </ChatProvider>
      </View>
    </KeyboardProvider>
  )
}

function Chat() {
  const { messages, setMessages } = useMessages()
  const { send } = useAppleChat({ setMessages, messages })
  const { shouldShowScrollToEnd, scrollToEnd } = useMessageListContext()
  const [showScrollToEnd, setShowScrollToEnd] = useState(false)
  const [animateMessageIndex, setAnimateMessageIndex] = useState<number | null>(
    null
  )

  useAnimatedReaction(
    () => shouldShowScrollToEnd.get(),
    (next, prev) => {
      if (next !== prev) {
        runOnJS(setShowScrollToEnd)(next)
      }
    },
    [shouldShowScrollToEnd]
  )

  const onSubmit = (message: string) => {
    const nextAssistantMessageIndex = messages.length + 1
    setAnimateMessageIndex(nextAssistantMessageIndex)
    send(message)
  }

  return (
    <>
      <ListContainer>
        <List data={messages} animateMessageIndex={animateMessageIndex} />
      </ListContainer>
      <Composer
        showScrollToEnd={showScrollToEnd}
        onScrollToEnd={() => scrollToEnd({ animated: true })}
        onSubmit={onSubmit}
      />
    </>
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
    <Animated.View
      {...containerProps}
      style={[styles.listContainer, containerStyle]}
    >
      {children}
    </Animated.View>
  )
}

function List({
  data,
  animateMessageIndex,
}: {
  data: UIMessage[]
  animateMessageIndex: number | null
}) {
  useKeyboardAwareMessageList({
    numMessages: data.length,
    lastUserMessageIndex: data.findLastIndex(item => item.role === 'user'),
  })
  useScrollOnComposerUpdate()

  const listProps = useMessageListProps({ bottomInsetPadding })

  return (
    <AnimatedLegendList
      keyboardDismissMode='interactive'
      estimatedItemSize={100}
      data={data}
      getItemType={item => item.role}
      keyExtractor={(_, index) => index.toString()}
      renderItem={({ item, index }) => {
        if (item.role === 'user') {
          return (
            <UserMessage message={item.content} messageIndex={index} isNewChat />
          )
        }

        return (
          <AssistantMessage
            message={item.content}
            messageIndex={index}
            isNewChat
            shouldAnimate={animateMessageIndex === index}
          />
        )
      }}
      {...listProps}
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
      <Text style={styles.text}>{message}</Text>
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
      style={[style, styles.userMessage]}
      ref={ref}
      onLayout={onLayout}
    >
      {children}
    </Animated.View>
  )
}

function AssistantMessage({
  message,
  messageIndex,
  isNewChat,
  shouldAnimate,
}: {
  message: string
  messageIndex: number
  isNewChat: boolean
  shouldAnimate: boolean
}) {
  return (
    <AssistantMessageAnimatedFrame
      messageIndex={messageIndex}
      isNewChat={isNewChat}
    >
      <Text style={styles.assistantText}>
        <TextFadeInStaggeredIfStreaming disabled={!shouldAnimate}>
          {message}
        </TextFadeInStaggeredIfStreaming>
      </Text>
    </AssistantMessageAnimatedFrame>
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
  const { onLayout, refToMeasure, renderedSize } = useMessageBlankSize({
    messageIndex,
    messageMinimumHeight: 20,
    bottomInset: 0,
    isLastMessage: isLast,
  })
  const { isComplete } = useFirstMessageEntrance({
    itemHeight: renderedSize,
    disabled: messageIndex !== 1 || !isNewChat,
  })

  const style = useAnimatedStyle(() => ({
    opacity: isComplete.get() ? withTiming(1, { duration: 350 }) : 0,
  }))

  return (
    <Animated.View style={style} ref={refToMeasure} onLayout={onLayout}>
      {children}
    </Animated.View>
  )
}

function Composer({
  onSubmit,
  onScrollToEnd,
  showScrollToEnd,
}: {
  onSubmit: (message: string) => void
  onScrollToEnd: () => void
  showScrollToEnd: boolean
}) {
  const colorScheme = useColorScheme()
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<TextInput>(null)
  const { composerHeight } = useComposerHeightContext()
  const { setIsMessageSendAnimating } = useChatAnimation()
  const { setKeyboardState, shouldOffsetCloseKeyboard } =
    useKeyboardContextState()

  const { onLayout, ref } = useSyncLayoutHandler(layout => {
    composerHeight.set(layout.height)
  })

  const handleSend = () => {
    const nextValue = inputValue.trim()
    if (!nextValue) {
      return
    }

    setInputValue('')
    onSubmit(nextValue)
    setKeyboardState('didHide')
    shouldOffsetCloseKeyboard.set(false)
    setIsMessageSendAnimating(true)

    requestAnimationFrame(() => {
      onScrollToEnd()
      Keyboard.dismiss()
    })
  }

  return (
    <View style={styles.footer} ref={ref} onLayout={onLayout}>
      {showScrollToEnd && (
        <Animated.View
          style={styles.scrollToEndButtonContainer}
          entering={buttonAnimation.entering}
          exiting={buttonAnimation.exiting}
        >
          <RoundButton onPress={onScrollToEnd}>
            <Text style={styles.buttonText}>v</Text>
          </RoundButton>
        </Animated.View>
      )}

      <View
        style={[
          styles.footerBackground,
          {
            experimental_backgroundImage:
              colorScheme === 'dark'
                ? 'linear-gradient(to bottom, #00000000, #000000)'
                : 'linear-gradient(to bottom, #ffffff00, #ffffff)',
          },
        ]}
      />

      <StickyView
        offset={{
          opened: -paddingVertical / 2,
          closed: -safeAreaInsetsBottom - paddingVertical / 2,
        }}
      >
        <View style={styles.footerRow}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TextInput
              onChangeText={setInputValue}
              style={styles.input}
              placeholderTextColor={PlatformColor('placeholderText')}
              placeholder='Type something...'
              ref={inputRef}
              multiline
              value={inputValue}
              autoFocus
            />
          </View>

          <RoundButton onPress={handleSend} disabled={inputValue.trim() === ''}>
            <Text style={styles.buttonText}>^</Text>
          </RoundButton>
        </View>
      </StickyView>
    </View>
  )
}

function StickyView({
  offset,
  style: styleProp,
  ...viewProps
}: React.ComponentProps<typeof Animated.View> & {
  offset?: { opened?: number; closed?: number }
}) {
  const { height, progress } = useReanimatedKeyboardAnimation()
  const openedOffset = offset?.opened ?? 0
  const closedOffset = offset?.closed ?? 0

  const style = useAnimatedStyle(() => {
    const y =
      height.get() +
      interpolate(
        progress.get(),
        [0, 1],
        [closedOffset, openedOffset]
      )

    return {
      transform: [{ translateY: y }],
    }
  })

  return <Animated.View {...viewProps} style={[style, styleProp]} />
}

function RoundButton({
  children,
  onPress,
  disabled = false,
}: {
  children: React.ReactNode
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        disabled
          ? {
              backgroundColor: PlatformColor('systemGray6'),
              borderColor: PlatformColor('systemGray5'),
            }
          : {
              backgroundColor: PlatformColor('systemGray3'),
              borderColor: PlatformColor('separator'),
            },
      ]}
    >
      {children}
    </Pressable>
  )
}

const buttonAnimation = {
  entering: new Keyframe({
    from: {
      transform: [{ scale: 0.9 }],
      opacity: 0,
    },
    to: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
  }).duration(150),
  exiting: new Keyframe({
    from: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    to: {
      transform: [{ scale: 0.8 }],
      opacity: 0,
    },
  }).duration(150),
}

function gap(size: number) {
  return size * 4
}

function lineHeight(size: number) {
  return size * 1.4
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  listContainer: {
    flex: 1,
  },
  text: {
    fontSize,
    lineHeight: lineHeight(fontSize),
    color: PlatformColor('label'),
  },
  assistantText: {
    fontSize,
    lineHeight: lineHeight(fontSize),
    color: PlatformColor('label'),
    paddingHorizontal: gap(4),
    paddingVertical: gap(2),
  },
  footerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingVertical,
    gap: gap(3),
    paddingHorizontal: gap(4),
  },
  input: {
    fontSize,
    color: PlatformColor('label'),
    backgroundColor: PlatformColor('systemBackground'),
    borderWidth: 1,
    borderColor: PlatformColor('separator'),
    paddingVertical: (44 - lineHeight(fontSize)) / 2,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: gap(4),
  },
  userMessage: {
    backgroundColor: PlatformColor('secondarySystemBackground'),
    paddingHorizontal: gap(4),
    paddingVertical: gap(2),
    borderRadius: 20,
    marginHorizontal: gap(4),
    alignSelf: 'flex-end',
    maxWidth: '70%',
    borderCurve: 'continuous',
    marginVertical: gap(3),
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  button: {
    height: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  buttonText: {
    color: PlatformColor('label'),
    fontSize: 20,
    fontWeight: '500',
  },
  footerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -24,
  },
  header: {
    paddingHorizontal: gap(4),
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PlatformColor('systemBackground'),
    borderBottomWidth: 1,
    borderBottomColor: PlatformColor('separator'),
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: PlatformColor('label'),
  },
  scrollToEndButtonContainer: {
    position: 'absolute',
    top: -48,
    paddingLeft: 16,
  },
})
