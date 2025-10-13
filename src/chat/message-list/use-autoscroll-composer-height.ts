import type { LegendListRef } from '@legendapp/list'
import { useComposerHeightContext } from '../composer/composer-height-context'
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated'

export function useAutoscrollFromComposerHeight(
  listRef: React.RefObject<LegendListRef | null>,
  scrollToEnd: (params?: { animated?: boolean }) => void
) {
  const { composerHeight } = useComposerHeightContext()

  const autoscrollToEnd = () => {
    const list = listRef.current
    if (list) {
      const state = list.getState()
      const distanceFromEnd =
        state.contentLength - state.scroll - state.scrollLength

      // It will be less than 0 when the last item is above the bottom of the screen
      // and 0 when it's at the bottom of the screen. This is because of the contentInset.
      if (distanceFromEnd < 0) {
        scrollToEnd({ animated: false })
        // It needs the LegendList to be updated with the new content height
        // so give it a frame to update
        setTimeout(() => {
          scrollToEnd({ animated: false })
        }, 16)
      }
    }
  }

  useAnimatedReaction(
    () => composerHeight.get(),
    (height, prevHeight) => {
      if (height > 0 && height !== prevHeight) {
        runOnJS(autoscrollToEnd)()
      }
    }
  )
}
