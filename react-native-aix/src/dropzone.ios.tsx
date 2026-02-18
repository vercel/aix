import { callback, getHostComponent } from 'react-native-nitro-modules'
import AixDropzoneConfig from '../nitrogen/generated/shared/json/AixDropzoneConfig.json'
import type { AixDropzoneProps, AixInputWrapperOnPasteEvent } from './views/aix.nitro'
import type { ComponentProps } from 'react'

const AixDropzoneInternal = getHostComponent<AixDropzoneProps, {}>(
  'AixDropzone',
  () => AixDropzoneConfig,
)

type AixDropzoneComponentProps = Omit<
  ComponentProps<typeof AixDropzoneInternal>,
  'onDrop' | 'hybridRef'
> & {
  onDrop?: (events: AixInputWrapperOnPasteEvent[]) => void
}

export function AixDropzone(props: AixDropzoneComponentProps) {
  return (
    <AixDropzoneInternal
      {...props}
      onDrop={props.onDrop ? callback(props.onDrop) : undefined}
    >
      {props.children}
    </AixDropzoneInternal>
  )
}
