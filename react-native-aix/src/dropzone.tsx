import type { PropsWithChildren } from 'react'
import type { AixInputWrapperOnPasteEvent } from './views/aix.nitro'

export type AixDropzoneComponentProps = PropsWithChildren<{
  onDrop?: (events: AixInputWrapperOnPasteEvent[]) => void
}>

export function AixDropzone(props: AixDropzoneComponentProps) {
  return <>{props.children}</>
}
