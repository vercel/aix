import type { SharedValue } from '@/ds/animated'

const DIST_FROM_END_BOTTOM_THRESHOLD = 12

/**
 * Determines if the user has scrolled far from the bottom of the message list.
 * Used to decide whether to auto-scroll to end when sending a message.
 * @param contentHeight - Total height of all messages in the list
 * @param scrollOffset - Current scroll position from the top
 * @returns true if user is more than 1000px away from the bottom
 */
export function isScrollFarAway({
  contentHeight,
  scrollOffset,
}: {
  contentHeight: number
  scrollOffset: number
}): boolean {
  'worklet'
  // Calculate distance from bottom: if content is 2000px and scroll is 500px,
  // then user is 1500px from bottom (2000 - 500 = 1500)
  return contentHeight - scrollOffset > 1000
}

/**
 * Calculates the scroll offset needed when the keyboard is opening.
 * This determines how much to adjust the scroll position to keep relevant content visible.
 * @returns The scroll offset amount - negative values scroll up, positive scroll down
 */
export function getOffsetWhenOpening({
  distFromEnd,
  vBlankSize,
  transform,
  distFromEndThreshold,
  maxBlankThreshold,
}: {
  distFromEnd: number
  vBlankSize: number
  transform: number
  distFromEndThreshold: number
  maxBlankThreshold: number
}): number {
  'worklet'
  let offset = 0

  // Case 1: User is very close to bottom (within the blank space area)
  if (distFromEnd < vBlankSize) {
    // If below the blank size then offset to push the message right above the keyboard
    if (vBlankSize < maxBlankThreshold) {
      // if we have at least this much blank space, then we can collapse the blank size to the transform
      offset = Math.max(-(vBlankSize - distFromEnd), -transform)
    } else {
      // otherwise, offset the transform to keep everything in place
      offset = -transform
    }
  } else if (distFromEnd < distFromEndThreshold && vBlankSize < transform) {
    // Case 2: User is somewhat close to bottom AND blank space is smaller than keyboard height
    if (vBlankSize) {
      // If the blank size is less than the transform, set the offset to push less than usual by the blank size amount
      offset = Math.max(-(transform - vBlankSize), -transform)
    } else {
      // Otherwise just push it
      offset = 0
    }
  } else {
    // Case 3: User is far from bottom - counteract the transform so content appears stationary
    // When transform pushes content up by X, offset pulls it down by X, net result = no movement
    offset = -transform
  }

  return offset
}

/**
 * Calculates scroll offset when keyboard is closing.
 * The logic is more complex because we need to smoothly transition back
 * while maintaining good UX for different scroll positions.
 */
export function getOffsetWhenNotOpening({
  distFromEnd,
  vBlankSizeFull,
  transform,
}: {
  distFromEnd: number
  vBlankSizeFull: number
  transform: number
}): number {
  'worklet'

  const isAtBottom = distFromEnd <= DIST_FROM_END_BOTTOM_THRESHOLD

  // When we're right at the bottom we keep the list anchored by letting the transform provide the offset.
  // Otherwise we cancel it out so the scroll position stays put while the keyboard closes.
  return isAtBottom ? -Math.min(vBlankSizeFull, transform) : -transform
}

/**
 * Core function that calculates scroll values during keyboard animation.
 * Handles multiple scenarios: opening/closing, message sending, interactive mode.
 * Returns either scroll offset + transform OR a command to scroll to end.
 */
export function getValuesOnMove(
  {
    vShouldOffsetCloseKeyboard,
    vAmtToOffset,
    vIsOpening,
    scrollAtStart,
    vScrollOffset,
    vAmtToTransform,
    eProgress,
    vIsMessageSendAnimating,
    vLastUserMessagePosition,
    vPaddingBottom,
    vContentHeight,
    vDoScrollToEnd,
  }: {
    vShouldOffsetCloseKeyboard: boolean
    vAmtToOffset: number
    vIsOpening: boolean
    scrollAtStart: SharedValue<number>
    vScrollOffset: number
    vAmtToTransform: number
    eProgress: number // 0-1 progress of keyboard animation
    vIsMessageSendAnimating: boolean
    vLastUserMessagePosition: number
    vPaddingBottom: number
    vContentHeight: number
    vDoScrollToEnd: boolean
  },
  interactive: boolean, // true when user is interactively dismissing keyboard
):
  | {
      offsetY: number | undefined
      translateY: number
      scrollToEnd?: never
    }
  | {
      offsetY?: never
      translateY?: never
      scrollToEnd: boolean
    } {
  'worklet'
  let offsetY: number | undefined = undefined
  // Transform adds inset as the keyboard opens (positive Y tracks upward movement)
  let translateY = eProgress * vAmtToTransform

  // Check if this is the first time this function is called for this animation
  const isFirstMove = scrollAtStart.get() === -1

  if (isFirstMove) {
    // Remember where we started scrolling from
    scrollAtStart.set(vScrollOffset)

    // Auto-scroll to end when sending message if:
    // - A message is being sent AND
    // - We're not already planning to scroll to end AND
    // - Keyboard is closing (not opening) AND
    // - Either we don't know last message position OR user scrolled far from bottom
    if (
      vIsMessageSendAnimating &&
      !vDoScrollToEnd &&
      !vIsOpening &&
      (vLastUserMessagePosition < 0 ||
        isScrollFarAway({ contentHeight: vContentHeight, scrollOffset: vScrollOffset }))
    ) {
      return { scrollToEnd: true }
    }
  }

  const vScrollAtStart = scrollAtStart.get()

  // Progress goes 0->1 when opening, 1->0 when closing
  const progress = vIsOpening ? eProgress : 1 - eProgress
  const totalOffsetDelta = vAmtToOffset + vAmtToTransform

  if (vIsMessageSendAnimating) {
    // Smoothly scroll to show the new message as keyboard animates
    const offset = vLastUserMessagePosition - vScrollAtStart - vPaddingBottom
    offsetY = vScrollAtStart + offset * progress
  } else if (vShouldOffsetCloseKeyboard && totalOffsetDelta !== 0) {
    // Apply the calculated offset gradually during keyboard animation. When opening we move content up,
    // and when closing we undo that movement so the list settles back into place.
    const appliedDelta = totalOffsetDelta * progress
    offsetY = vIsOpening ? vScrollAtStart + appliedDelta : vScrollAtStart - appliedDelta
  } else if (interactive) {
    // Pin scroll position during interactive keyboard dismissal
    // The scroll position needs to change slightly for reanimated to register the update,
    // but we want it to appear stationary, so oscillate between -0.5 and 0.5 pixels
    offsetY = vScrollAtStart + Math.abs(progress) - 0.5
  }

  return {
    offsetY,
    translateY,
  }
}
