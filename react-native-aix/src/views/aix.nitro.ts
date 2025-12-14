import type { HybridView, HybridViewProps } from 'react-native-nitro-modules'

export interface AixProps extends HybridViewProps {
  shouldStartAtEnd: boolean
  scrollOnComposerSizeUpdate: boolean
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
}

export type Aix = HybridView<AixProps, {}, { ios: 'swift'; android: 'kotlin' }>

export interface AixCellViewProps extends HybridViewProps {
  isLast: boolean
  index: number
}

export type AixCellView = HybridView<
  AixCellViewProps,
  {},
  { ios: 'swift'; android: 'kotlin' }
>

export interface AixComposerProps extends HybridViewProps {}

export type AixComposer = HybridView<
  AixComposerProps,
  {},
  { ios: 'swift'; android: 'kotlin' }
>
