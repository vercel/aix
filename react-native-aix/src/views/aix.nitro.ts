import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules'

export interface AixProps extends HybridViewProps {
   isRed: boolean
}

export interface AixMethods extends HybridViewMethods {}

export type Aix = HybridView<AixProps, AixMethods, { ios: 'swift', android: 'kotlin' }>