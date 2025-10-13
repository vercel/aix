import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import useLatestCallback from 'use-latest-callback'

export function useInitialScrollToEnd(
  blankSize: SharedValue<number>,
  scrollToEnd: (params: { animated?: boolean }) => void,
  hasMessages: boolean
) {
  const hasStartedScrolledToEnd = useSharedValue(false)
  const hasScrolledToEnd = useSharedValue(false)
  const scrollToEndJS = useLatestCallback(() => {
    scrollToEnd({ animated: false })
    // Do another one just in case because the list may not have fully laid out yet
    requestAnimationFrame(() => {
      scrollToEnd({ animated: false })

      // and another one again in case
      setTimeout(() => {
        scrollToEnd({ animated: false })

        // and yet another lol
        requestAnimationFrame(() => {
          hasScrolledToEnd.set(true)
        })
      }, 16)
    })
  })

  useAnimatedReaction(
    () => {
      if (hasStartedScrolledToEnd.get() || !hasMessages) {
        return -1
      }
      console.log('[blankSize]', blankSize.get())
      return blankSize.get()
    },
    (current) => {
      if (current >= 0) {
        hasStartedScrolledToEnd.set(true)
        runOnJS(scrollToEndJS)()
      }
    }
  )

  return hasScrolledToEnd
}
