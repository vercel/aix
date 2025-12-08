import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSyncLayoutHandler } from '../use-sync-layout'
import { useKeyboardContextState } from '../keyboard/provider'
import { useCallback, useLayoutEffect } from 'react'
import type { LayoutChangeEvent, LayoutRectangle } from 'react-native'
import { useMessageListContext } from './context'
import { useComposerHeightContext } from '../composer/composer-height-context'
import { useThrottledCallback } from '../../utils/useDebouncedCallback'

function isLastMessage(lastMessageIndex: number, index: number) {
  return lastMessageIndex === index
}

function isLastMessageWorklet(
  lastMessageIndex: SharedValue<number>,
  index: number
) {
  'worklet'
  return lastMessageIndex.get() === index
}

export const useMessageBlankSize = ({
  messageIndex: index,
  messageMinimumHeight,
  bottomInset,
}: {
  messageIndex: number
  /**
   * Line height + padding * 2
   */
  messageMinimumHeight: number
  bottomInset: number
}) => {
  const {
    getPreviousMessageSize,
    blankSize,
    blankSizeFull,
    scrollViewHeight,
    getListState,
    lastMessageIndex,
  } = useMessageListContext()
  const { composerHeight } = useComposerHeightContext()
  const previousMessageSize = useSharedValue<number | undefined>(
    getPreviousMessageSize(index)
  )
  const renderedSize = useSharedValue<number>(0)
  const { keyboardState, keyboardHeight } = useKeyboardContextState()
  const lastMessageIndexSharedValue = lastMessageIndex.sharedValue

  useAnimatedReaction(
    () => {
      let minHeight = 0
      let minHeightFull = 0
      let size = 0

      const isLast = isLastMessageWorklet(lastMessageIndexSharedValue, index)

      if (isLast) {
        const composerSize = composerHeight.get()
        const smallMessageHeight = messageMinimumHeight
        const minSpacing = previousMessageSize.get() ?? smallMessageHeight
        const spacingAtTop = Math.min(minSpacing, smallMessageHeight * 2)
        const isKeyboardVisible = keyboardState.get() === 'didShow'
        const minHeightBase =
          scrollViewHeight.get() - spacingAtTop - composerSize
        const minHeightKeyboard = Math.max(
          minHeightBase - keyboardHeight.get(),
          0
        )
        minHeightFull = Math.max(minHeightBase - bottomInset, 0)
        minHeight = isKeyboardVisible ? minHeightKeyboard : minHeightFull
        size = renderedSize.get()
      }

      return {
        isLast,
        minHeight,
        minHeightFull,
        size,
      }
    },
    (value) => {
      const { isLast, minHeight, minHeightFull, size } = value
      if (isLast && size > 0) {
        blankSize.set(Math.max(minHeight - size, 0))
        blankSizeFull.set(Math.max(minHeightFull - size, 0))
      }
    }
  )

  useLayoutEffect(() => {
    const isLast = isLastMessage(lastMessageIndex.ref.current, index)
    if (isLast) {
      const size = getPreviousMessageSize(index)
      if (size) {
        previousMessageSize.set(size)
      }
    }
  }, [
    getPreviousMessageSize,
    lastMessageIndex,
    index,
    previousMessageSize,
    getListState,
  ])

  const updateSize = useCallback(
    (layout: LayoutRectangle) => {
      const isLast = isLastMessage(lastMessageIndex.ref.current, index)
      if (isLast) {
        renderedSize.set(layout.height)
      }
    },
    [lastMessageIndex, index, renderedSize]
  )

  // useSyncLayoutHandler is used to measure the size of the message on the initial render
  const { ref: refToMeasure } = useSyncLayoutHandler(updateSize)

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { layout } = event.nativeEvent
      const { height } = layout
      const isLast = isLastMessage(lastMessageIndex.ref.current, index)
      if (isLast) {
        renderedSize.set(height)
      }
    },
    [renderedSize, lastMessageIndex, index]
  )

  return {
    onLayout,
    refToMeasure,
    renderedSize,
  }
}
