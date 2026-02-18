import type { PropsWithChildren } from 'react'
import type { ViewProps } from 'react-native'
import type {
  AixInputWrapperOnPasteEvent,
  AixInputWrapperProps,
} from './views/aix.nitro'

type AixInputWrapperComponentProps = PropsWithChildren<
  ViewProps &
    Omit<AixInputWrapperProps, 'onPaste'> & {
      onPaste?: (events: AixInputWrapperOnPasteEvent[]) => void
    }
>

export function AixInputWrapper(props: AixInputWrapperComponentProps) {
  return <>{props.children}</>
}
