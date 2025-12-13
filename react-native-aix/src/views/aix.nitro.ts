import type { HybridView, HybridViewProps } from 'react-native-nitro-modules'

export interface AixProps extends HybridViewProps {
  shouldStartAtEnd: boolean
  scrollOnComposerSizeUpdate: boolean
  /**
   * The number of pixels from the bottom of the scroll view to the end of the content that is considered "near the end".
   *
   * If the scroll view is scrolled to the end of the content, and the content is less than this threshold, the content will be shifted up when the keyboard is opened.
   *
   * Default: 200
   *
   */
  scrollEndReachedThreshold?: number
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
