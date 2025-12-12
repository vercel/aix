import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import AixConfig from '../nitrogen/generated/shared/json/AixConfig.json'
import type {
  AixProps,
  AixMethods,
} from './views/aix.nitro'


export const Aix = getHostComponent<AixProps, AixMethods>(
  'Aix',
  () => AixConfig
)

export type AixRef = HybridRef<AixProps, AixMethods>
