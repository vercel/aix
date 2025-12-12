import { TextInput } from 'react-native'
import { FullWindowOverlay } from 'react-native-screens'
import { useKeyboardContextState } from './chat/keyboard/provider'
import Animated, {
  DerivedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'

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
    () =>
      `contentInset.bottom: (ty + ch + bs) = ${Math.round(bottomInset.get())}`
  )
  const translateYText = useDerivedValue(
    () => `translateY (kb - safe): ${Math.round(translateY.get())}`
  )
  const keyboardHeightText = useDerivedValue(
    () => `Expanded Keyboard Height: ${Math.round(keyboardHeight.get())}`
  )
  const keyboardStateText = useDerivedValue(
    () => `keyboardState: ${keyboardState.get()}`
  )
  const scrollYText = useDerivedValue(
    () => `scrollY: ${Math.round(scrollY.get())}`
  )
  const offsetYText = useDerivedValue(
    () => `offsetY: ${Math.round(offsetY.get())}`
  )
  const contentHeightText = useDerivedValue(
    () => `contentHeight: ${Math.round(contentHeight.get())}`
  )
  const scrollViewHeightText = useDerivedValue(
    () => `scrollViewHeight: ${Math.round(scrollViewHeight.get())}`
  )
  const composerHeightText = useDerivedValue(
    () => `composerHeight: ${Math.round(composerHeight.get())}`
  )
  const activeKeyboardHeight = useReanimatedKeyboardAnimation().height
  const activeKeyboardHeightText = useDerivedValue(
    () => `activeKeyboardHeight: ${Math.round(activeKeyboardHeight.get())}`
  )
  const drag = useSharedValue({ x: 0, y: 0 })
  const gesture = Gesture.Pan().onChange((event) => {
    'worklet'
    console.log('event', event)
    drag.modify((value) => {
      return {
        x: value.x + event.changeX,
        y: value.y + event.changeY,
      }
    })
  })
  return (
    <FullWindowOverlay>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          style={{
            backgroundColor: '#111111',
            marginTop: 100,
            alignSelf: 'flex-start',
            padding: 16,
            borderRadius: 8,
            position: 'absolute',
            bottom: '50%',
            left: 0,
            width: 350,
          }}
          pointerEvents='none'
        >
          <GestureDetector gesture={gesture}>
            <Animated.View style={{ gap: 8 }}>
              <AnimatedText value={blankSizeFullText} />
              {/* <AnimatedText value={keyboardHeightText} /> */}
              {/* <AnimatedText value={keyboardStateText} /> */}
              <AnimatedText value={blankSizeText} />
              <AnimatedText value={translateYText} />
              <AnimatedText value={composerHeightText} />
              <AnimatedText value={bottomInsetText} />
              <AnimatedText value={offsetYText} />
              {/* <AnimatedText value={contentHeightText} /> */}
              {/* <AnimatedText value={scrollViewHeightText} /> */}
              <AnimatedText value={activeKeyboardHeightText} />
              <AnimatedText value={scrollYText} />
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
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
