import type { PropsWithChildren } from 'react'
import type { AixInputWrapperOnPasteEvent } from './views/aix.nitro'
import type { StyleProp, ViewStyle } from 'react-native'

export type AixDropzoneComponentProps = PropsWithChildren<{
  onDrop?: (events: AixInputWrapperOnPasteEvent[]) => void
  style?: StyleProp<ViewStyle>
}>

export function AixDropzone(props: AixDropzoneComponentProps) {
  return <>{props.children}</>
}
