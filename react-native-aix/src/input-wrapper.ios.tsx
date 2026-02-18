import { callback, getHostComponent } from 'react-native-nitro-modules'
import AixInputWrapperConfig from '../nitrogen/generated/shared/json/AixInputWrapperConfig.json'
import type {
  AixInputWrapperProps,
  AixInputWrapperOnPasteEvent,
} from './views/aix.nitro'
import type { ComponentProps } from 'react'

const AixInputWrapperInternal = getHostComponent<AixInputWrapperProps, {}>(
  'AixInputWrapper',
  () => AixInputWrapperConfig
)

type AixInputWrapperComponentProps = Omit<
  ComponentProps<typeof AixInputWrapperInternal>,
  'onPaste' | 'hybridRef'
> & {
  onPaste?: (events: AixInputWrapperOnPasteEvent[]) => void
}

export function AixInputWrapper(props: AixInputWrapperComponentProps) {
  return (
    <AixInputWrapperInternal
      {...props}
      onPaste={props.onPaste ? callback(props.onPaste) : undefined}
    >
      {props.children}
    </AixInputWrapperInternal>
  )
}
