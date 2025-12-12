import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules'

export interface AixProps extends HybridViewProps {
  shouldStartAtEnd: boolean
  scrollOnComposerSizeUpdate: boolean
}

export interface ScrollToEndOnBlankSizeUpdateInput {
  forIndex: number
}

export interface AixMethods extends HybridViewMethods {
  scrollToEndOnBlankSizeUpdate: (
    input: ScrollToEndOnBlankSizeUpdateInput
  ) => void
}

export type Aix = HybridView<
  AixProps,
  AixMethods,
  { ios: 'swift'; android: 'kotlin' }
>

export interface AixBlankViewProps extends HybridViewProps {
  isLast: boolean
}

export interface AixBlankViewMethods extends HybridViewMethods {
  setIsLast: (isLast: boolean) => void
}

export type AixBlankView = HybridView<
  AixBlankViewProps,
  AixBlankViewMethods,
  { ios: 'swift'; android: 'kotlin' }
>

export interface AixComposerProps extends HybridViewProps {}

export interface AixComposerMethods extends HybridViewMethods {}

export type AixComposer = HybridView<
  AixComposerProps,
  AixComposerMethods,
  { ios: 'swift'; android: 'kotlin' }
>
