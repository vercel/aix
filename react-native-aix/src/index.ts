import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import AixConfig from '../nitrogen/generated/shared/json/AixConfig.json'
import AixCellViewConfig from '../nitrogen/generated/shared/json/AixCellViewConfig.json'
import AixComposerConfig from '../nitrogen/generated/shared/json/AixComposerConfig.json'
import type {
  AixCellViewProps,
  AixComposerProps,
  AixProps,
  AixMethods,
} from './views/aix.nitro'

export const Aix = getHostComponent<AixProps, {}>('Aix', () => AixConfig)

export type AixRef = HybridRef<AixProps, AixMethods>

export const AixCellView = getHostComponent<AixCellViewProps, {}>(
  'AixCellView',
  () => AixCellViewConfig
)

export type AixCellViewRef = HybridRef<AixCellViewProps, {}>

export const AixComposer = getHostComponent<AixComposerProps, {}>(
  'AixComposer',
  () => AixComposerConfig
)
