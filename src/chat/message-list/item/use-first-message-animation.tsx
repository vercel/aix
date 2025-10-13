import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useSyncLayoutHandler } from '../../use-sync-layout'
import { useCallback } from 'react'
import { useFirstMessageEntrance } from './use-first-message-entrance'

export function useFirstMessageAnimation({
  messageIndex,
}: {
  messageIndex: number
}) {
  const renderedSize = useSharedValue(0)
  const { ref: refToMeasure } = useSyncLayoutHandler(
    useCallback(
      (layout) => {
        renderedSize.set(layout.height)
      },
      [renderedSize]
    )
  )

  const { progress, translateY } = useFirstMessageEntrance({
    index: messageIndex,
    type: 'user',
    itemHeight: renderedSize,
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
  }
}
