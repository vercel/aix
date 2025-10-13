import {
  useSharedValue,
  type SharedValue,
  useAnimatedScrollHandler,
  useDerivedValue,
} from 'react-native-reanimated'
import type { View } from 'react-native'
import { useComposerHeightContext } from '../composer/composer-height-context'
import { useMemoOnce } from '../../utils/use-memo-once'
import {
  useSharedValueAndRef,
  type SharedValueAndRef,
} from '../../utils/use-shared-value-and-ref'
import { useSyncLayoutHandler } from '../use-sync-layout'
import type { LegendListRef, ScrollState } from '@legendapp/list'
import { createContext, useCallback, useContext, useRef } from 'react'
import {
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  useWindowDimensions,
} from 'react-native'

export type MessageListContextType = {
  blankSize: SharedValue<number>
  blankSizeFull: SharedValue<number>
  scrollViewHeight: SharedValue<number>
  lastUserMessage: SharedValue<{
    index: number
    position: number
  }>
  lastMessageIndex: SharedValueAndRef<number>
  getPreviousMessageSize: (index: number) => number | undefined
  getListState: () => ScrollState | undefined
  // Indicates if the chat initially started with exactly one message
  startedWithOneMessage: SharedValue<boolean>
  listRef: React.RefObject<LegendListRef | null>
  refOuter: React.RefObject<View | null>
  onOuterLayout: (layout: LayoutChangeEvent) => void
  showScrollIndicator: SharedValue<boolean>
  bottomInset: SharedValue<number>
  translateY: SharedValue<number>
  // Scroll-to-end functionality
  scrollY: SharedValue<number>
  offsetY: SharedValue<number>
  contentHeight: SharedValue<number>
  shouldShowScrollToEnd: SharedValue<boolean>
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onContentSizeChange: (width: number, height: number) => void
  scrollToEnd: (params?: { animated?: boolean }) => void
}

const MessageListContext = createContext<MessageListContextType>(
  undefined as any
)

function useScrollToEnd(
  bottomInset: SharedValue<number>,
  listRef: React.RefObject<LegendListRef | null>,
  scrollY: SharedValue<number>,
  contentHeight: SharedValue<number>,
  scrollViewHeight: SharedValue<number>
) {
  const { height } = useWindowDimensions()

  const shouldShowScrollToEnd = useDerivedValue(() => {
    const scrollHeight = scrollViewHeight.get()
    const minScrollableHeight = height / 4
    const scrollToBottomThreshold = 15

    if (scrollHeight < minScrollableHeight) {
      return false
    }

    if (contentHeight.get() < scrollHeight) {
      return false
    }

    const scrollableHeight = contentHeight.get() - scrollHeight
    const distanceToBottom = scrollableHeight - scrollY.get()
    const isCloseToBottom = distanceToBottom < scrollToBottomThreshold

    return !isCloseToBottom
  })

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y)
  }, [])

  const onContentSizeChange = useCallback(
    (_: number, height: number) => {
      contentHeight.set(height)
    },
    [contentHeight]
  )

  const scrollToEnd = useCallback(
    (params: { animated?: boolean } = { animated: true }) => {
      if (listRef.current) {
        listRef.current.scrollToEnd({
          animated: params.animated,
          viewOffset: -bottomInset.get(), // TODO figure out why this scrolls over too much
          // viewOffset: 0, // this fixes it for the first message...
        })
      }
    },
    [bottomInset, listRef]
  )

  return {
    shouldShowScrollToEnd,
    onScroll,
    onContentSizeChange,
    scrollToEnd,
    bottomInset,
  }
}

function useMessageListLayout(scrollViewHeight: SharedValue<number>) {
  const { onLayout: onOuterLayout, ref: refOuter } = useSyncLayoutHandler(
    useCallback(
      (layout) => {
        scrollViewHeight.set(layout.height)
      },
      [scrollViewHeight]
    )
  )

  return {
    onOuterLayout,
    refOuter,
  }
}

function useMessageListState(listRef: React.RefObject<LegendListRef | null>) {
  const getPreviousMessageSize = useCallback(
    (index: number) => {
      if (index === 0) {
        return 0
      }
      const previousMessageSize = listRef.current
        ?.getState()
        ?.sizeAtIndex(index - 1)
      return previousMessageSize
    },
    [listRef]
  )

  const getListState = useCallback(() => listRef.current?.getState(), [listRef])

  return {
    getPreviousMessageSize,
    getListState,
  }
}

interface MessageListContextProviderProps {
  children: React.ReactNode
}

export const MessageListContextProvider = ({
  children,
}: MessageListContextProviderProps) => {
  const { composerHeight } = useComposerHeightContext()
  // All shared values
  const translateY = useSharedValue(0)
  // -1 means that the blank size is not set yet. we need this because the blank size is not set until the message is rendered.
  // useInitialScrollToEnd depends on this being -1 at the start
  const blankSize = useSharedValue(-1)
  const blankSizeFull = useSharedValue(0)
  const showScrollIndicator = useSharedValue(true)
  const scrollViewHeight = useSharedValue(0)
  const scrollY = useSharedValue(0)
  const offsetY = useSharedValue(Number.MAX_SAFE_INTEGER)
  const contentHeight = useSharedValue(0)
  const lastUserMessage = useSharedValue<{ index: number; position: number }>({
    index: -1,
    position: -1,
  })
  const lastMessageIndex = useSharedValueAndRef<number>(-1)
  const startedWithOneMessage = useSharedValue(false)
  const listRef = useRef<LegendListRef | null>(null)

  const bottomInset = useDerivedValue(() => {
    return blankSize.get() + composerHeight.get() + translateY.get()
  })

  // Hooks to set up the sharedValues
  const { getPreviousMessageSize, getListState } = useMessageListState(listRef)
  const { onOuterLayout, refOuter } = useMessageListLayout(scrollViewHeight)
  const { shouldShowScrollToEnd, onScroll, onContentSizeChange, scrollToEnd } =
    useScrollToEnd(
      bottomInset,
      listRef,
      scrollY,
      contentHeight,
      scrollViewHeight
    )

  // Create context value
  const ctxValue = useMemoOnce<MessageListContextType>(
    () => ({
      blankSize,
      blankSizeFull,
      scrollViewHeight,
      lastUserMessage,
      lastMessageIndex,
      getPreviousMessageSize,
      getListState,
      startedWithOneMessage,
      listRef,
      refOuter,
      onOuterLayout,
      showScrollIndicator,
      bottomInset,
      translateY,
      scrollY,
      offsetY,
      contentHeight,
      shouldShowScrollToEnd,
      onScroll,
      onContentSizeChange,
      scrollToEnd,
    }),
    [
      blankSize,
      blankSizeFull,
      scrollViewHeight,
      lastUserMessage,
      lastMessageIndex,
      getPreviousMessageSize,
      getListState,
      startedWithOneMessage,
      listRef,
      refOuter,
      onOuterLayout,
      showScrollIndicator,
      bottomInset,
      translateY,
      scrollY,
      offsetY,
      contentHeight,
      shouldShowScrollToEnd,
      onScroll,
      onContentSizeChange,
      scrollToEnd,
    ]
  )

  return (
    <MessageListContext.Provider value={ctxValue}>
      {children}
    </MessageListContext.Provider>
  )
}

export function useMessageListContext() {
  return useContext(MessageListContext)
}
