import { describe, expect, test } from '@jest/globals'
import {
  getOffsetWhenOpening,
  getOffsetWhenNotOpening,
  isScrollFarAway,
  getValuesOnMove,
} from './keyboard-message-list-helpers'

describe('getOffsetWhenOpening', () => {
  // to reproduce: create a new chat, and just send "hi"
  test('small chat; blank space even when keyboard is open', () => {
    expect(
      getOffsetWhenOpening({
        distFromEnd: 2.66668701171875,
        vBlankSize: 492.3333435058594,
        transform: 302,
        distFromEndThreshold: 100,
        maxBlankThreshold: 1,
      }),
    ).toBe(-302)

    expect(
      getOffsetWhenOpening({
        distFromEnd: 0,
        vBlankSize: 525.3749694824219,
        transform: 302,
        distFromEndThreshold: 100,
        maxBlankThreshold: 1,
      }),
    ).toBe(-302)
  })

  // to reproduce: open an existing chat, with the assistant message length greater than the screen
  // and open the keyboard
  test('messages stick to bottom in large chat scrolled to end', () => {
    expect(
      getOffsetWhenOpening({
        distFromEnd: 0,
        vBlankSize: 0,
        transform: 302,
        distFromEndThreshold: 100,
        maxBlankThreshold: 336,
      }),
    ).toBe(0)

    expect(
      getOffsetWhenOpening({
        distFromEnd: 2.66668701171875,
        vBlankSize: 0,
        transform: 302,
        distFromEndThreshold: 100,
        maxBlankThreshold: 1,
      }),
    ).toBe(0)
  })

  // to reproduce: scroll up mid-conversation in a long chat to read previous messages
  test('user scrolled up mid-conversation (typical browsing)', () => {
    // Common scenario: user scrolled up 200px in a long chat to read previous messages
    expect(
      getOffsetWhenOpening({
        distFromEnd: 250,
        vBlankSize: 0,
        transform: 350, // iPhone keyboard
        distFromEndThreshold: 100,
        maxBlankThreshold: 350,
      }),
    ).toBe(-350) // Keep content stationary by counteracting transform

    // User scrolled up but still close to bottom
    expect(
      getOffsetWhenOpening({
        distFromEnd: 80,
        vBlankSize: 20,
        transform: 300,
        distFromEndThreshold: 100,
        maxBlankThreshold: 300,
      }),
    ).toBe(-280) // Partial offset to show more content
  })

  // to reproduce: test with different keyboard sizes (numeric pad vs full keyboard with predictions)
  test('different keyboard sizes (small vs large)', () => {
    // Small keyboard (numeric pad)
    expect(
      getOffsetWhenOpening({
        distFromEnd: 0,
        vBlankSize: 100,
        transform: 230,
        distFromEndThreshold: 100,
        maxBlankThreshold: 300,
      }),
    ).toBe(-100) // Collapse blank space completely (distFromEnd=0, so -(100-0) = -100)

    // Large keyboard with predictions
    expect(
      getOffsetWhenOpening({
        distFromEnd: 0,
        vBlankSize: 100,
        transform: 420,
        distFromEndThreshold: 100,
        maxBlankThreshold: 400,
      }),
    ).toBe(-100) // Same logic applies regardless of transform size when collapsing blank
  })

  // to reproduce: test edge cases with zero values for blank space and distance
  test('edge cases with zero values', () => {
    // No blank space, at bottom
    expect(
      getOffsetWhenOpening({
        distFromEnd: 0,
        vBlankSize: 0,
        transform: 300,
        distFromEndThreshold: 100,
        maxBlankThreshold: 300,
      }),
    ).toBe(0) // No offset needed

    // Very small distance from end
    expect(
      getOffsetWhenOpening({
        distFromEnd: 1,
        vBlankSize: 50,
        transform: 300,
        distFromEndThreshold: 100,
        maxBlankThreshold: 300,
      }),
    ).toBe(-49) // Collapse blank space: Math.max(-(50-1), -300) = -49
  })

  // to reproduce: start a short conversation with lots of blank space below messages
  test('large blank space scenarios', () => {
    // Lot of blank space (short conversation)
    expect(
      getOffsetWhenOpening({
        distFromEnd: 10,
        vBlankSize: 400,
        transform: 300,
        distFromEndThreshold: 100,
        maxBlankThreshold: 350,
      }),
    ).toBe(-300) // Use full transform when blank > threshold

    // Blank space exactly at threshold
    expect(
      getOffsetWhenOpening({
        distFromEnd: 5,
        vBlankSize: 350,
        transform: 300,
        distFromEndThreshold: 100,
        maxBlankThreshold: 350,
      }),
    ).toBe(-300) // Use full transform at boundary
  })
})

describe('getOffsetWhenNotOpening', () => {
  test('returns 0 when the list is at the bottom', () => {
    expect(
      getOffsetWhenNotOpening({
        distFromEnd: 0,
        transform: 300,
        vBlankSizeFull: 0,
      }),
    ).toBe(-0)

    expect(
      getOffsetWhenNotOpening({
        distFromEnd: -5,
        transform: 420,
        vBlankSizeFull: 0,
      }),
    ).toBe(-0)

    expect(
      getOffsetWhenNotOpening({
        distFromEnd: 80,
        transform: 320,
        vBlankSizeFull: 0,
      }),
    ).toBe(-320)
  })

  test('cancels the transform when user is away from bottom', () => {
    expect(
      getOffsetWhenNotOpening({
        distFromEnd: 40,
        transform: 300,
        vBlankSizeFull: 0,
      }),
    ).toBe(-300)

    expect(
      getOffsetWhenNotOpening({
        distFromEnd: 150,
        transform: 420,
        vBlankSizeFull: 0,
      }),
    ).toBe(-420)
  })
})

describe('isScrollFarAway', () => {
  // to reproduce: scroll to exactly 1000px from bottom to test threshold behavior
  test('exactly at 1000px threshold', () => {
    expect(isScrollFarAway({ contentHeight: 2000, scrollOffset: 1000 })).toBe(false) // exactly 1000px from bottom
    expect(isScrollFarAway({ contentHeight: 2000, scrollOffset: 999 })).toBe(true) // 1001px from bottom
    expect(isScrollFarAway({ contentHeight: 2000, scrollOffset: 1001 })).toBe(false) // 999px from bottom
  })

  // to reproduce: test common scroll positions in conversations of different lengths
  test('common scroll positions', () => {
    // User at top of long conversation
    expect(isScrollFarAway({ contentHeight: 5000, scrollOffset: 0 })).toBe(true)

    // User near bottom
    expect(isScrollFarAway({ contentHeight: 2000, scrollOffset: 1500 })).toBe(false)

    // User in middle of conversation
    expect(isScrollFarAway({ contentHeight: 3000, scrollOffset: 1000 })).toBe(true)
  })

  // to reproduce: test edge cases with very short content and zero scroll positions
  test('edge cases', () => {
    // Very short content
    expect(isScrollFarAway({ contentHeight: 500, scrollOffset: 0 })).toBe(false)

    // Zero scroll offset
    expect(isScrollFarAway({ contentHeight: 1500, scrollOffset: 0 })).toBe(true)

    // Scrolled past content (shouldn't happen but test anyway)
    expect(isScrollFarAway({ contentHeight: 1000, scrollOffset: 1200 })).toBe(false)
  })
})

describe('getValuesOnMove', () => {
  // Mock SharedValue implementation
  const mockSharedValue = (initialValue: number) => ({
    get: () => initialValue,
    set: (value: number) => {
      initialValue = value
    },
  })

  // to reproduce: send a message while scrolled far from bottom (first keyboard movement)
  test('first move triggers scroll to end for message sending when far away', () => {
    const scrollAtStart = mockSharedValue(-1) // Indicates first move

    const result = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard: false,
        vAmtToOffset: 0,
        vIsOpening: false,
        scrollAtStart: scrollAtStart as any,
        vScrollOffset: 0, // User at top (far from bottom)
        vAmtToTransform: 300,
        eProgress: 0.5,
        vIsMessageSendAnimating: true,
        vLastUserMessagePosition: -1, // Unknown position
        vPaddingBottom: 20,
        vContentHeight: 2000,
        vDoScrollToEnd: false,
      },
      false,
    )

    expect(result).toEqual({ scrollToEnd: true })
  })

  // to reproduce: continue keyboard animation after initial move during message sending
  test('subsequent moves apply message send animation', () => {
    const scrollAtStart = mockSharedValue(100) // Not first move

    const result = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard: false,
        vAmtToOffset: 0,
        vIsOpening: true,
        scrollAtStart: scrollAtStart as any,
        vScrollOffset: 150,
        vAmtToTransform: 300,
        eProgress: 0.5, // Half open
        vIsMessageSendAnimating: true,
        vLastUserMessagePosition: 1800,
        vPaddingBottom: 20,
        vContentHeight: 2000,
        vDoScrollToEnd: false,
      },
      false,
    )

    // Should apply smooth animation towards message position
    expect(result.offsetY).toBe(940) // 100 + (1800 - 100 - 20) * 0.5 = 100 + 1680 * 0.5 = 940
    expect(result.translateY).toBe(150) // 0.5 * 300
  })

  // to reproduce: dismiss keyboard interactively (swipe down) while scrolled in conversation
  test('interactive keyboard dismissal pins scroll position', () => {
    const scrollAtStart = mockSharedValue(200)

    const result = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard: false,
        vAmtToOffset: 0,
        vIsOpening: false,
        scrollAtStart: scrollAtStart as any,
        vScrollOffset: 300,
        vAmtToTransform: 350,
        eProgress: 0.3, // Closing
        vIsMessageSendAnimating: false,
        vLastUserMessagePosition: 1500,
        vPaddingBottom: 20,
        vContentHeight: 2000,
        vDoScrollToEnd: false,
      },
      true, // interactive
    )

    // Should oscillate around start position for reanimated
    expect(result.offsetY).toBe(200.2) // 200 + Math.abs(0.7) - 0.5 = 200 + 0.7 - 0.5 = 200.2
    expect(result.translateY).toBe(105) // 0.3 * 350
  })

  // to reproduce: open keyboard when offset calculations are needed
  test('keyboard opening with offset applied', () => {
    const scrollAtStart = mockSharedValue(500)

    const result = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard: true,
        vAmtToOffset: -100,
        vIsOpening: true,
        scrollAtStart: scrollAtStart as any,
        vScrollOffset: 600,
        vAmtToTransform: 300,
        eProgress: 0.8,
        vIsMessageSendAnimating: false,
        vLastUserMessagePosition: 1200,
        vPaddingBottom: 20,
        vContentHeight: 1800,
        vDoScrollToEnd: false,
      },
      false,
    )

    expect(result.offsetY).toBe(660) // 500 + (200 * 0.8)
    expect(result.translateY).toBe(240) // 0.8 * 300
  })

  // to reproduce: close keyboard while anchored at the bottom of the chat
  test('keyboard closing anchors list to bottom', () => {
    const scrollAtStart = mockSharedValue(400)

    const result = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard: true,
        vAmtToOffset: 0,
        vIsOpening: false, // Closing
        scrollAtStart: scrollAtStart as any,
        vScrollOffset: 450,
        vAmtToTransform: 350,
        eProgress: 0.2, // Almost closed
        vIsMessageSendAnimating: false,
        vLastUserMessagePosition: 1000,
        vPaddingBottom: 20,
        vContentHeight: 1500,
        vDoScrollToEnd: false,
      },
      false,
    )

    // For closing: progress = 1 - eProgress = 1 - 0.2 = 0.8
    expect(result.offsetY).toBe(120) // 400 - (350 * 0.8)
    expect(result.translateY).toBe(70) // 0.2 * 350
  })

  test('keyboard closing away from bottom keeps scroll position', () => {
    const scrollAtStart = mockSharedValue(400)

    const result = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard: true,
        vAmtToOffset: -350, // Cancel transform to avoid shifting content
        vIsOpening: false,
        scrollAtStart: scrollAtStart as any,
        vScrollOffset: 450,
        vAmtToTransform: 350,
        eProgress: 0.2,
        vIsMessageSendAnimating: false,
        vLastUserMessagePosition: 1000,
        vPaddingBottom: 20,
        vContentHeight: 1500,
        vDoScrollToEnd: false,
      },
      false,
    )

    expect(result.offsetY).toBeUndefined()
    expect(result.translateY).toBe(70)
  })

  // to reproduce: test scenario where animation conditions are not met
  test('no animation when conditions not met', () => {
    const scrollAtStart = mockSharedValue(300)

    const result = getValuesOnMove(
      {
        vShouldOffsetCloseKeyboard: false,
        vAmtToOffset: 0,
        vIsOpening: true,
        scrollAtStart: scrollAtStart as any,
        vScrollOffset: 350,
        vAmtToTransform: 250,
        eProgress: 0.6,
        vIsMessageSendAnimating: false,
        vLastUserMessagePosition: 800,
        vPaddingBottom: 20,
        vContentHeight: 1200,
        vDoScrollToEnd: false,
      },
      false,
    )

    expect(result.offsetY).toBe(undefined) // No offset applied
    expect(result.translateY).toBe(150) // 0.6 * 250
  })
})
