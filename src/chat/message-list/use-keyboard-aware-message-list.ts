import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import {
  useKeyboardHandler,
  type NativeEvent,
} from 'react-native-keyboard-controller'

import { useKeyboardContextState } from '../keyboard/provider'
import {
  getOffsetWhenNotOpening,
  getOffsetWhenOpening,
  getValuesOnMove,
  isScrollFarAway,
} from './keyboard-message-list-helpers'
import { useChatAnimation } from '../animation/chat-animation-context'
import { useMessageListContext } from './context'
import { useComposerHeightContext } from '../composer/composer-height-context'
import { AppState } from 'react-native'

/**
 * Hook that manages the message list behavior when the keyboard opens/closes.
 * Handles smooth animations and scroll positioning to keep messages visible and properly positioned.
 */
export function useKeyboardAwareMessageList({
  numMessages: numMessagesProp,
  chatPaddingBottom = 0,
  bottomInset = 0,
}: {
  numMessages: number
  chatPaddingBottom?: number
  bottomInset?: number
}) {
  const {
    blankSize,
    blankSizeFull,
    contentHeight,
    lastUserMessage,
    listRef,
    offsetY,
    scrollY,
    scrollViewHeight,
    showScrollIndicator,
    translateY,
  } = useMessageListContext()
  const { composerHeight } = useComposerHeightContext()
  const {
    shouldOffsetCloseKeyboard,
    keyboardHeight,
    keyboardStateActual,
    keyboardState,
  } = useKeyboardContextState()
  const { isMessageSendAnimating } = useChatAnimation()

  // Tracks whether we used interactive keyboard dismissal (swipe down to close)
  const didInteractive = useSharedValue(false)
  // Stores the scroll position when keyboard animation starts
  const scrollAtStart = useSharedValue(0)
  // How much to offset the scroll position during keyboard animation
  const amtToOffset = useSharedValue(0)
  // How much to transform (move up) the content when keyboard opens
  const amtToTransform = useSharedValue(0)
  // Flag to trigger scrolling to the end of the message list
  const doScrollToEnd = useSharedValue(false)
  // Whether keyboard is opening (true) or closing (false)
  const isOpening = useSharedValue(false)
  // Whether keyboard handling is enabled (disabled for single message chats)
  const isEnabled = useSharedValue(false)
  // Synced copy of the message count for worklet access
  const numMessages = useSharedValue(numMessagesProp)

  const setScrollProcessingEnabled = (enabled: boolean) => {
    listRef.current?.setScrollProcessingEnabled(enabled)
  }

  /**
   * Calculates scroll offset and transform values during keyboard animation.
   * Handles different scenarios like message sending animations and interactive dismissal.
   */
  const getOnMoveValues = (
    e: NativeEvent,
    isAnimating?: boolean,
    interactive?: boolean
  ) => {
    'worklet'
    const vShouldOffsetCloseKeyboard = shouldOffsetCloseKeyboard.get()
    const vAmtToOffset = amtToOffset.get()
    const vIsOpening = isOpening.get() as boolean
    const vAmtToTransform = amtToTransform.get()
    const eProgress = e.progress
    const vIsMessageSendAnimating = isAnimating || isMessageSendAnimating.get()
    const vLastUserMessagePosition = lastUserMessage.get().position

    const values = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard,
        vIsMessageSendAnimating,
        vAmtToOffset,
        vIsOpening,
        scrollAtStart,
        vScrollOffset: scrollY.get(),
        vAmtToTransform,
        eProgress,
        vLastUserMessagePosition,
        vPaddingBottom: chatPaddingBottom,
        vContentHeight: contentHeight.get(),
        vDoScrollToEnd: doScrollToEnd.get(),
      },
      !!interactive
    )

    return values
  }

  const scrollToEnd = () => {
    doScrollToEnd.set(true)
    listRef.current?.scrollToEnd({ animated: true })
  }

  /**
   * Handles smooth scrolling when keyboard is closed but message sending animation is active.
   * Used to scroll to newly sent messages after keyboard disappears.
   */
  const onMoveWhileClosed = () => {
    'worklet'
    scrollAtStart.set(scrollY.get())
    isOpening.set(false)
    amtToOffset.set(0)
    doScrollToEnd.set(false)

    const { offsetY: offsetYValue } = getOnMoveValues(
      {
        progress: 0,
        height: 0,
        duration: 0,
        target: 0,
      },
      true
    )

    if (offsetYValue !== undefined) {
      offsetY.set(scrollY.get())
      offsetY.set(withTiming(offsetYValue, { duration: 350 }))
    }
  }

  // Keep numMessages SharedValue in sync with prop
  useEffect(() => {
    numMessages.set(numMessagesProp)
  }, [numMessages, numMessagesProp])

  // Reaction that triggers scroll-to-end behavior when the last message is rendered
  useAnimatedReaction(
    () => {
      return doScrollToEnd.get() && lastUserMessage.get()
    },
    (lastMessage) => {
      if (
        lastMessage &&
        lastMessage.index === numMessages.get() - 1 &&
        lastMessage.position >= 0
      ) {
        scrollAtStart.set(scrollY.get())
        onMoveWhileClosed()
        doScrollToEnd.set(false)
      }
    },
    []
  )

  /**
   * Called when keyboard animation starts. Calculates initial offset values
   * and determines how the message list should behave during the animation.
   */
  const onStart = (e: NativeEvent) => {
    'worklet'

    const wasInteractive = didInteractive.get()

    if (wasInteractive) {
      translateY.set(0)
    }

    // Only enable for multi-message chats and non-interactive dismissals
    isEnabled.set(numMessages.get() > 1 && !wasInteractive)

    if (!isEnabled.get()) {
      return
    }

    showScrollIndicator.set(false)

    scrollAtStart.set(-1)
    isOpening.set(e.progress === 1)
    if (isOpening.get()) {
      shouldOffsetCloseKeyboard.set(true)
      keyboardHeight.set(e.height)
    }

    const vKbHeight = keyboardHeight.get()
    const vBlankSize = blankSize.get()
    const vBlankSizeFull = blankSizeFull.get()
    const vContentHeight = contentHeight.get()
    const vScrollerAnimSize = scrollViewHeight.get()
    const vOffsetY = scrollY.get()
    const vIsMessageSendAnimating = isMessageSendAnimating.get()
    const vComposerHeight = composerHeight.get()
    // How much to move content up (keyboard height minus safe area)
    const transform = vKbHeight - bottomInset

    // Calculate how far the user is scrolled from the bottom of the content
    const distFromEnd =
      vContentHeight -
      vOffsetY -
      vScrollerAnimSize +
      vBlankSize +
      vComposerHeight

    amtToTransform.set(transform)

    // Calculate how much to offset the scroll position based on keyboard state and content position
    let offset = 0
    if (isOpening.get()) {
      // When opening, decide whether to stick to bottom, push content up, or keep in place
      offset = getOffsetWhenOpening({
        distFromEnd,
        vBlankSize,
        transform,
        distFromEndThreshold: 100, // Consider "near bottom" if within 100px
        maxBlankThreshold: vKbHeight + vComposerHeight,
      })
    } else if (!vIsMessageSendAnimating) {
      // When closing, restore appropriate scroll position
      offset = getOffsetWhenNotOpening({
        distFromEnd,
        vBlankSizeFull,
        transform,
      })
    }

    if (!vIsMessageSendAnimating) {
      // Disable scroll processing to prevent expensive calculations during keyboard animation
      // This improves performance by avoiding unnecessary layout calculations
      runOnJS(setScrollProcessingEnabled)(false)
    }

    amtToOffset.set(offset)
  }

  /**
   * Called during keyboard animation. Updates scroll position and transform values
   * to maintain proper message positioning as keyboard moves.
   */
  const onMove = (
    e: NativeEvent,
    interactive?: boolean,
    skipOffset?: boolean
  ) => {
    'worklet'

    // Skip if keyboard handling is disabled
    if (!isEnabled.get()) {
      return
    }

    const values = getOnMoveValues(e, false, interactive)

    if (values.scrollToEnd) {
      // For far-away scrolls during message sending, jump to end instead of animating
      doScrollToEnd.set(true)
      runOnJS(scrollToEnd)()
    } else {
      // Apply calculated scroll offset to maintain content positioning
      if (!skipOffset && !doScrollToEnd.get() && values.offsetY !== undefined) {
        offsetY.set(values.offsetY)
      }

      // Apply transform to move content up/down with keyboard
      if (values.translateY !== undefined) {
        translateY.set(values.translateY)
      }
    }
  }

  const onEnd = (e: NativeEvent, skipOffset?: boolean) => {
    'worklet'

    console.log('[onEnd]')

    const wasInteractive = didInteractive.get()
    if (wasInteractive && e.progress === 0 && e.target > 0) {
      // After an interactive drag it can fire twice. The first one has progress 0 and target of a positive number.
      // The second one has progress 0 and target -1, which is the real end. So we skip the first one.
      return
    }

    if (isEnabled.get() || wasInteractive) {
      // Clear message sending animation state
      isMessageSendAnimating.set(false)

      // Set enabled back to true or onMove doesn't do anything
      isEnabled.set(true)
      // Ensure we reach target position if onMove didn't fire on close
      onMove(e, false, skipOffset || wasInteractive)

      // Re-enable performance optimizations disabled during animation
      runOnJS(setScrollProcessingEnabled)(true)
      showScrollIndicator.set(true)
    }

    // Reset scroll tracking
    scrollAtStart.set(-1)

    // Interactive dismissal fires onEnd twice - reset flag on second call
    if (wasInteractive) {
      didInteractive.set(false)
    }
  }

  useKeyboardHandler(
    {
      onStart,
      onInteractive(e) {
        'worklet'

        if (!isEnabled.get()) {
          return
        }

        // Interactive dismissal (swipe down) - setup initial values on first frame
        if (!didInteractive.get()) {
          onStart(e)
          didInteractive.set(true)
        }

        // Apply interactive animation calculations
        onMove(e, true, /*skipOffset*/ true)
      },
      onMove,
      onEnd,
    },
    []
  )

  // Keep keyboard transform in sync when the list content changes while the keyboard is open
  // The reaction only runs after the keyboard settles. When new messages arrive or the
  // blank space shrinks while the keyboard stays visible we replay the opening logic in one
  // frame so the translateY/offset values match the new layout instead of waiting for the
  // next keyboard event.
  useAnimatedReaction(
    () => {
      // Snapshot the values that influence where the list should sit relative to the keyboard
      return {
        num: numMessages.get(),
        blank: blankSizeFull.get(),
      }
    },
    (current, previous) => {
      // Bail immediately if we don't have both the current and previous values yet
      if (!current || !previous) {
        return
      }

      // Only react if the keyboard is in the fully shown state
      if (
        keyboardStateActual.get() !== 'didShow' ||
        keyboardState.get() !== 'didShow'
      ) {
        return
      }

      // Track whether content length changed and whether blankSizeFull shrank/grew materially
      const numChanged = current.num !== previous.num
      const blankChanged = Math.abs(current.blank - previous.blank) > 0.5

      // Skip if nothing substantive changed while the keyboard was open
      if (!numChanged && !blankChanged) {
        return
      }

      // When transitioning from no messages to some, avoid offsetting the scroll position
      const fromEmpty = previous.num === 0 && current.num > 0

      const nativeEvent: NativeEvent = {
        progress: 1,
        duration: 0,
        target: 0,
        height: keyboardHeight.get(),
      }
      // Skip offset if we're just bootstrapping messages; otherwise keep scroll + transform in sync
      const skipOffset = fromEmpty

      onStart(nativeEvent)
      onMove(nativeEvent, /*interactive*/ false, skipOffset)
      onEnd(nativeEvent, skipOffset)
    },
    []
  )

  // Handle message sending when keyboard is closed - either scroll to end or animate smoothly
  useAnimatedReaction(
    () =>
      !doScrollToEnd.get() &&
      keyboardStateActual.get() === 'didHide' && {
        vIsMessageSendAnimating: isMessageSendAnimating.get(),
        vLastUserMessageIndex: lastUserMessage.get()?.index,
      },
    (info, prev) => {
      if (
        info &&
        prev &&
        info.vIsMessageSendAnimating &&
        info.vIsMessageSendAnimating === prev.vIsMessageSendAnimating &&
        info.vLastUserMessageIndex > 1 &&
        info.vLastUserMessageIndex > prev.vLastUserMessageIndex
      ) {
        // After isMessageSendAnimating gets set to true, we want to wait
        // for the next user message to come in and increase the index
        // then do the move while closed animation
        const isFarAway = isScrollFarAway({
          contentHeight: contentHeight.get(),
          scrollOffset: scrollY.get(),
        })

        if (isFarAway) {
          // Jump to end because we may not have a correct lastUserMessage position
          runOnJS(scrollToEnd)()
        } else {
          // Smooth animation for nearby scrolls
          onMoveWhileClosed()
        }
      }
    },
    []
  )
}
