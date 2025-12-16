import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import AixCellViewConfig from '../nitrogen/generated/shared/json/AixCellViewConfig.json'
import type { AixCellViewProps } from './views/aix.nitro'
import { useRef } from 'react'
import type { AixRef } from './aix'

export { Aix, type AixRef } from './aix'
export { AixFooter } from './footer'

export const AixCell = getHostComponent<AixCellViewProps, {}>(
  'AixCellView',
  () => AixCellViewConfig
)

export type AixCellViewRef = HybridRef<AixCellViewProps, {}>

export function useAixRef() {
  return useRef<AixRef | null>(null)
}
