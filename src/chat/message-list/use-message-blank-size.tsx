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
import { useDebouncedCallback } from '../../utils/useDebouncedCallback'

export const useMessageBlankSize = ({
  messageIndex: index,
  messageMinimumHeight,
  bottomInset,
  isLastMessage,
}: {
  messageIndex: number
  isLastMessage: boolean
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
  } = useMessageListContext()
  const { composerHeight } = useComposerHeightContext()
  const previousMessageSize = useSharedValue<number | undefined>(
    getPreviousMessageSize(index)
  )
  const renderedSize = useSharedValue<number>(0)
  const { keyboardState, keyboardHeight } = useKeyboardContextState()

  useAnimatedReaction(
    () => {
      let minHeight = 0
      let minHeightFull = 0
      let size = 0

      const isLast = isLastMessage

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
    const isLast = isLastMessage
    if (isLast) {
      const size = getPreviousMessageSize(index)
      if (size) {
        previousMessageSize.set(size)
      }
    }
  }, [
    getPreviousMessageSize,
    isLastMessage,
    index,
    previousMessageSize,
    getListState,
  ])

  const updateSize = useCallback(
    (layout: LayoutRectangle) => {
      const isLast = isLastMessage
      if (isLast) {
        renderedSize.set(layout.height)
      }
    },
    [isLastMessage, index, renderedSize]
  )

  // useSyncLayoutHandler is used to measure the size of the message on the initial render
  const { ref: refToMeasure } = useSyncLayoutHandler(updateSize)

  // Create a debounced callback to use when increasnig the size
  const debouncedSetRenderedSize = useDebouncedCallback(updateSize, 500)

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { layout } = event.nativeEvent
      const { height } = layout
      // Debounce if it's growing and it's not the first height so that the size is not updated too often
      // and also so that blankSize is not shrunk too soon, which could cause scroll jumping
      const isLast = isLastMessage
      if (isLast) {
        if (renderedSize.get() > 0 && height > renderedSize.get()) {
          debouncedSetRenderedSize(layout)
        } else {
          renderedSize.set(height)
        }
      }
    },
    [debouncedSetRenderedSize, renderedSize, isLastMessage, index]
  )

  return {
    onLayout,
    refToMeasure,
    renderedSize,
  }
}
