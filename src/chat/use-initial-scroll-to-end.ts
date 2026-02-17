import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import useLatestCallback from 'use-latest-callback'
import { scheduleOnRN } from 'react-native-worklets'
import { useEffect } from 'react'

export function useInitialScrollToEnd(
  blankSize: SharedValue<number>,
  scrollToEnd: (params: { animated?: boolean }) => void,
  hasMessages: boolean
) {
  const hasStartedScrolledToEnd = useSharedValue(false)
  const hasScrolledToEnd = useSharedValue(false)
  const scrollToEndJS = useLatestCallback(() => {
    scrollToEnd({ animated: false })
    hasScrolledToEnd.set(true)
  })

  useEffect(
    function timeout() {
      if (hasMessages && !hasScrolledToEnd.get()) {
        const timer = setTimeout(() => {
          hasScrolledToEnd.set(true)
        }, 1_000) // todo make this a prop or something

        return () => clearTimeout(timer)
      }
      return undefined
    },
    [hasMessages, hasScrolledToEnd]
  )

  useAnimatedReaction(
    () => {
      if (hasStartedScrolledToEnd.get() || !hasMessages) {
        return -1
      }
      return blankSize.get()
    },
    (current) => {
      if (current >= 0) {
        hasStartedScrolledToEnd.set(true)
        scheduleOnRN(scrollToEndJS)
      }
    }
  )

  return hasScrolledToEnd
}
