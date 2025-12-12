import type { HybridView, HybridViewProps } from 'react-native-nitro-modules'

export interface AixProps extends HybridViewProps {
  shouldStartAtEnd: boolean
  scrollOnComposerSizeUpdate: boolean
}

export type Aix = HybridView<AixProps, {}, { ios: 'swift'; android: 'kotlin' }>

export interface AixCellViewProps extends HybridViewProps {
  isLast: boolean
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
