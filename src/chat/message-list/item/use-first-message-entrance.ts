import {
  Easing,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  withSpring,
  type SharedValue,
  useDerivedValue,
} from 'react-native-reanimated'
import { useKeyboardContextState } from '../../keyboard/provider'
import { useMessageListContext } from '../context'
import { useWindowDimensions } from 'react-native-keyboard-controller'
import { useChatAnimation } from '../../animation/chat-animation-context'

type Params = {
  disabled?: boolean
  itemHeight: SharedValue<number>
}

function getAnimatedValues({
  itemHeight,
  windowHeight,
  keyboardHeight,
}: {
  itemHeight: number
  windowHeight: number
  keyboardHeight: number
}) {
  'worklet'
  // Normalize by message height to make smaller messages faster and closer
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(v, max))
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const minH = 32
  const maxH = 220
  const h = clamp(itemHeight, minH, maxH)
  const t = (h - minH) / (maxH - minH) // 0 for small -> 1 for large

  // Start just below the keyboard; small messages start closer than large ones
  const baseFromY = windowHeight - keyboardHeight
  const extraY = lerp(16, h * 0.85, t) // small ≈ 16px; large ≈ 85% of its height
  const y = baseFromY + extraY

  // Duration scales with size: small faster, large slower
  const base = 600
  const duration = Math.round(lerp(base * 0.75, base * 1.15, t) * 1.08) // ever so slightly slower

  // iOS-like ease-out (approximates iMessage without spring)
  const easing = Easing.out(Easing.cubic)

  // Subtle spring for translateY to mimic iMessage settle
  const springConfig = {
    damping: 28,
    stiffness: 200,
    mass: 0.7,
    overshootClamping: false,
    restDisplacementThreshold: 0.25,
    restSpeedThreshold: 0.25,
  }

  return {
    from: { translateY: y, progress: 0 },
    to: { translateY: 0, progress: 1 },
    duration,
    easing,
    springConfig,
  }
}

// TODO remove "type" and abstract it better. hook should only run on proper message in the container
// TODO make the styles adaptible / dependency injected
export function useFirstMessageEntrance({ disabled, itemHeight }: Params) {
  const { keyboardHeight } = useKeyboardContextState()
  const { isMessageSendAnimating } = useChatAnimation()
  const { height: windowHeight } = useWindowDimensions()
  const translateY = useSharedValue(0)
  const progress = useSharedValue(-1)

  useAnimatedReaction(
    () => itemHeight.get(),
    (height) => {
      if (height > 0 && progress.get() === -1) {
        const eligible = isMessageSendAnimating.get() && !disabled

        if (eligible) {
          const kbHeight = keyboardHeight.get()
          const animatedValues = getAnimatedValues({
            itemHeight: height,
            windowHeight,
            keyboardHeight: kbHeight,
          })
          const { from, to, duration, easing, springConfig } = animatedValues
          translateY.set(
            withTiming(from.translateY, { duration: 0 }, () => {
              translateY.set(withSpring(to.translateY, springConfig as any))
            })
          )
          progress.set(
            withTiming(from.progress, { duration: 0 }, () => {
              progress.set(withTiming(to.progress, { duration, easing }))
            })
          )
        }
      }
    }
  )

  const isComplete = useDerivedValue(() => {
    return translateY.get() === 0
  })

  return { progress, translateY, isComplete }
}
