import { getHostComponent } from 'react-native-nitro-modules'
import AixCellViewConfig from '../nitrogen/generated/shared/json/AixCellViewConfig.json'
import type { AixCellViewProps } from './views/aix.nitro'

export const AixCell = getHostComponent<AixCellViewProps, {}>(
  'AixCellView',
  () => AixCellViewConfig,
)
