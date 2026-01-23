import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules'

export interface AixAdditionalContentInsets {
  whenKeyboardOpen: number
  whenKeyboardClosed: number
}

export interface AixAdditionalContentInsetsProp {
  top?: AixAdditionalContentInsets
  bottom?: AixAdditionalContentInsets
}

export interface AixScrollIndicatorInsetValue {
  whenKeyboardOpen: number
  whenKeyboardClosed: number
}

export interface AixScrollIndicatorInsets {
  top?: AixScrollIndicatorInsetValue
  bottom?: AixScrollIndicatorInsetValue
}

export interface AixScrollOnFooterSizeUpdate {
  /**
   * Whether to scroll on footer size update.
   *
   * Default: true
   */
  enabled: boolean
  /**
   * The number of pixels from the bottom of the scroll view to the end of the content that is considered "scrolled near the end".
   *
   * Default: 100
   */
  scrolledToEndThreshold?: number
  /**
   * Whether to animate the scroll.
   *
   * Default: false
   */
  animated?: boolean
}

export interface AixContentInsets {
  top?: number
  left?: number
  bottom?: number
  right?: number
}

export interface AixProps extends HybridViewProps {
  shouldStartAtEnd: boolean
  /**
   * Control the behavior of scrolling the content when footer size changes.
   *
   * By default, changing the height of the footer will shift content up in the scroll view.
   *
   * Default: { enabled: true, scrolledToEndThreshold: 100, animated: false }
   */
  scrollOnFooterSizeUpdate?: AixScrollOnFooterSizeUpdate
  /**
   * The number of pixels from the bottom of the scroll view to the end of the content that is considered "near the end".
   *
   * If the scroll view is scrolled to the end of the content, and the content is less than this threshold, the content will be shifted up when the keyboard is opened.
   *
   * By default, it will be the greater of the current blank size, or 200.
   *
   * TODO make this a more adaptive prop, like { strategy: 'blank-size', min: 200 } | { strategy: 'fixed', value: 200 }
   *
   */
  scrollEndReachedThreshold?: number
  /**
   * Scroll end blank size threshold.
   *
   * If the blank size is less than this threshold, then the content will collapse to the keyboard when the keyboard is opened.
   *
   * You likely don't need to customize this much.
   *
   * Default: 0
   *
   * TODO we might want to implement this, but i'm not sure.
   *
   * By default, the content will collapse to the keyboard on opening if the blank size is less than half the size of the scroll view parent, and greater than the keyboard height.
   */

  additionalContentInsets?: AixAdditionalContentInsetsProp

  /**
   * Additional insets for the scroll indicator, added to existing safe area insets.
   * Applied to verticalScrollIndicatorInsets on iOS.
   */
  additionalScrollIndicatorInsets?: AixScrollIndicatorInsets

  /**
   * The nativeID of the scroll view to use.
   *
   * If provided, will search for a scroll view with this accessibilityIdentifier.
   * If not provided or not found, falls back to the default subview iteration logic.
   */
  mainScrollViewID?: string

  /**
   * Used to index of the second-to-last message.
   *
   * For AI chat apps, it should correspond to the index of the last user message.
   *
   * By default, it will simply be the seccond-to-last item. Specifically, it will correspond to the Cell index before the <Cell isLast />.
   *
   * However, if you use custom message types, you can override it with this prop.
   *
   * For example, if you use a "<Timestamp />" row in your LegendList or FlashList implementation, then you can set this value.
   *
   * This indicates which message will be scrolled into view.
   *
   */
  penultimateCellIndex?: number

  shouldApplyContentInsets?: boolean
  onWillApplyContentInsets?: (insets: AixContentInsets) => void
}

export interface AixMethods extends HybridViewMethods {
  scrollToEnd(animated?: boolean): void
  scrollToIndexWhenBlankSizeReady(
    index: number,
    animated?: boolean,
    waitForKeyboardToEnd?: boolean
  ): void
}

export type Aix = HybridView<
  AixProps,
  AixMethods,
  { ios: 'swift'; android: 'kotlin' }
>

export interface AixCellViewProps extends HybridViewProps {
  isLast: boolean
  index: number
}

export type AixCellView = HybridView<
  AixCellViewProps,
  {},
  { ios: 'swift'; android: 'kotlin' }
>

export interface AixStickToKeyboardOffset {
  whenKeyboardOpen: number
  whenKeyboardClosed: number
}

export interface AixStickToKeyboard {
  enabled: boolean
  offset?: AixStickToKeyboardOffset
}

export interface AixComposerProps extends HybridViewProps {
  stickToKeyboard?: AixStickToKeyboard
}

export type AixComposer = HybridView<
  AixComposerProps,
  {},
  { ios: 'swift'; android: 'kotlin' }
>
