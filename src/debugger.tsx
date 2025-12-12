import { Text, TextInput, View } from 'react-native'
import { FullWindowOverlay } from 'react-native-screens'
import { useKeyboardContextState } from './chat/keyboard/provider'
import Animated, {
  DerivedValue,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'

import { useMessageListContext } from './chat/message-list/context'
import { useComposerHeightContext } from './chat/composer/composer-height-context'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'

export function Debugger() {
  const { keyboardState, keyboardHeight } = useKeyboardContextState()
  const {
    blankSize,
    blankSizeFull,
    bottomInset,
    contentHeight,
    scrollViewHeight,
    translateY,
    scrollY,
    offsetY,
  } = useMessageListContext()
  const { composerHeight } = useComposerHeightContext()
  const blankSizeText = useDerivedValue(
    () => `Blank Size: ${Math.round(blankSize.get())}`
  )
  const blankSizeFullText = useDerivedValue(
    () => `Blank Size Full: ${Math.round(blankSizeFull.get())}`
  )
  const bottomInsetText = useDerivedValue(
    () => `Bottom Inset: ${Math.round(bottomInset.get())}`
  )
  const keyboardHeightText = useDerivedValue(
    () => `Keyboard Height: ${Math.round(keyboardHeight.get())}`
  )
  const keyboardStateText = useDerivedValue(
    () => `Keyboard State: ${keyboardState.get()}`
  )
  const translateYText = useDerivedValue(
    () => `Translate Y: ${Math.round(translateY.get())}`
  )
  const scrollYText = useDerivedValue(
    () => `Scroll Y: ${Math.round(scrollY.get())}`
  )
  const offsetYText = useDerivedValue(
    () => `Offset Y: ${Math.round(offsetY.get())}`
  )
  const contentHeightText = useDerivedValue(
    () => `Content Height: ${Math.round(contentHeight.get())}`
  )
  const scrollViewHeightText = useDerivedValue(
    () => `Scroll View Height: ${Math.round(scrollViewHeight.get())}`
  )
  const composerHeightText = useDerivedValue(
    () => `Composer Height: ${Math.round(composerHeight.get())}`
  )
  const activeKeyboardHeight = useReanimatedKeyboardAnimation().height
  const activeKeyboardHeightText = useDerivedValue(
    () => `Active Keyboard Height: ${Math.round(activeKeyboardHeight.get())}`
  )
  return (
    <FullWindowOverlay>
      <View
        style={{
          gap: 8,
          backgroundColor: '#111111',
          marginTop: 100,
          alignSelf: 'flex-start',
          padding: 16,
          borderRadius: 8,
          position: 'absolute',
          bottom: '50%',
          left: 0,
          width: 250,
        }}
        pointerEvents='none'
      >
        <AnimatedText value={blankSizeText} />
        <AnimatedText value={blankSizeFullText} />
        <AnimatedText value={bottomInsetText} />
        <AnimatedText value={keyboardHeightText} />
        <AnimatedText value={keyboardStateText} />
        <AnimatedText value={translateYText} />
        <AnimatedText value={scrollYText} />
        <AnimatedText value={offsetYText} />
        <AnimatedText value={contentHeightText} />
        <AnimatedText value={scrollViewHeightText} />
        <AnimatedText value={composerHeightText} />
        <AnimatedText value={activeKeyboardHeightText} />
      </View>
    </FullWindowOverlay>
  )
}

const Input = Animated.createAnimatedComponent(TextInput)

function AnimatedText({ value }: { value: DerivedValue<string> }) {
  return (
    <Input
      animatedProps={useAnimatedProps(() => {
        return {
          text: value.get().toString(),
        } as any
      })}
      style={[
        useAnimatedStyle(() => {
          return {
            display: value.get().toString().length > 0 ? 'flex' : 'none',
          }
        }),
        {
          color: 'white',
        },
      ]}
    />
  )
}
