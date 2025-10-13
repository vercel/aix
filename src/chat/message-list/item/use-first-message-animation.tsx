'use memo'
import { useAnimatedStyle } from 'react-native-reanimated'
import { useFirstMessageEntrance } from './use-first-message-entrance'
import { useMessageRenderedHeight } from './use-message-rendered-size'

export function useFirstMessageAnimation({ disabled }: { disabled: boolean }) {
  const { renderedSize, refToMeasure, onLayout } = useMessageRenderedHeight()

  const { progress, translateY } = useFirstMessageEntrance({
    itemHeight: renderedSize,
    disabled,
  })

  // TODO this should get provided by the user and be dynamic only for the first message
  const userAnimatedStyle = useAnimatedStyle(() => ({
    transform:
      progress.get() >= 0 ? [{ translateY: translateY.get() }] : undefined,
    opacity: progress.get() >= 0 ? progress.get() : undefined,
  }))

  return {
    style: userAnimatedStyle,
    ref: refToMeasure,
    onLayout,
  }
}
