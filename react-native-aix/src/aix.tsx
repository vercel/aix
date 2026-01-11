import {
  callback,
  getHostComponent,
  type HybridRef,
} from 'react-native-nitro-modules'
import AixConfig from '../nitrogen/generated/shared/json/AixConfig.json'
import type { AixProps, AixMethods } from './views/aix.nitro'
import { forwardRef } from 'react'

export type AixRef = HybridRef<AixProps, AixMethods>

const AixInternal = getHostComponent<AixProps, AixMethods>(
  'Aix',
  () => AixConfig
)

type Without<T, K extends keyof T> = Omit<T, K>

type Props = Without<
  React.ComponentProps<typeof AixInternal>,
  '_shouldSubtractHeightOfPenultimateCellFromBlankSize'
> & {
  shouldSubtractHeightOfPenultimateCellFromBlankSize?: boolean
}

export const Aix = forwardRef<AixRef, Props>(function Aix(props, ref) {
  return (
    <AixInternal
      {...props}
      _shouldSubtractHeightOfPenultimateCellFromBlankSize={
        props.shouldSubtractHeightOfPenultimateCellFromBlankSize
      }
      hybridRef={
        ref
          ? callback((r) => {
              if (typeof ref === 'function') {
                ref(r)
              } else {
                ref.current = r
              }
            })
          : undefined
      }
    />
  )
})
