import {
  callback,
  getHostComponent,
  type HybridRef,
} from 'react-native-nitro-modules'
import AixConfig from '../nitrogen/generated/shared/json/AixConfig.json'
import type { AixProps, AixMethods, AixContentInsets } from './views/aix.nitro'
import { forwardRef, type ComponentProps } from 'react'
import Animated from 'react-native-reanimated'

export type AixRef = HybridRef<AixProps, AixMethods>

const AixInternal = Animated.createAnimatedComponent(getHostComponent<AixProps, AixMethods>(
  'Aix',
  () => AixConfig
))

// User-facing props type that accepts regular functions (not wrapped callbacks)
type AixComponentProps = Omit<
  ComponentProps<typeof AixInternal>,
  'onWillApplyContentInsets' | 'hybridRef'
> & {
  onWillApplyContentInsets?: (insets: AixContentInsets) => void
}

export const Aix = forwardRef<AixRef, AixComponentProps>(
  function Aix(props, ref) {
    return (
      <AixInternal
        {...props}
        scrollOnFooterSizeUpdate={
          props.scrollOnFooterSizeUpdate ?? {
            enabled: true,
            scrolledToEndThreshold: 100,
            animated: false,
          }
        }
        // Wrap onWillApplyContentInsets with callback() if provided
        onWillApplyContentInsets={
          props.onWillApplyContentInsets
            ? callback(props.onWillApplyContentInsets)
            : undefined
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
  }
)
