import { useCallback } from 'react'
import { useSyncLayoutHandler } from '../../use-sync-layout'
import { useSharedValue } from 'react-native-reanimated'

export function useMessageRenderedHeight() {
  const renderedSize = useSharedValue(0)
  const { ref: refToMeasure, onLayout } = useSyncLayoutHandler(
    useCallback(
      (layout) => {
        renderedSize.set(layout.height)
      },
      [renderedSize]
    )
  )

  return {
    onLayout,
    refToMeasure,
    renderedSize,
  }
}
