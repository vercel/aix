import {
  callback,
  getHostComponent,
  type HybridRef,
} from 'react-native-nitro-modules'
import AixConfig from '../nitrogen/generated/shared/json/AixConfig.json'
import type { AixProps, AixMethods } from './views/aix.nitro'
import { forwardRef, useRef } from 'react'

export type AixRef = HybridRef<AixProps, AixMethods>

const AixInternal = getHostComponent<AixProps, AixMethods>(
  'Aix',
  () => AixConfig
)

export const Aix = forwardRef<AixRef, React.ComponentProps<typeof AixInternal>>(
  function Aix(props, ref) {
    return (
      <AixInternal
        {...props}
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
  }
)
