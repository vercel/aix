import { callback, getHostComponent } from 'react-native-nitro-modules'
import AixInputWrapperConfig from '../nitrogen/generated/shared/json/AixInputWrapperConfig.json'
import type {
  AixInputWrapperProps,
  AixInputWrapperOnPasteEvent,
} from './views/aix.nitro'
import React, { Children, type ComponentProps } from 'react'
import { Platform, type TextInputProps } from 'react-native'

const NATIVE_ID_KEYS = {
  textInput: 'textInput',
}

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
  if (Platform.OS !== 'ios') return null

  const hasChildren = Children.count(props.children)
  if (hasChildren <= 0) return null

  const childrenWithProps = Children.map(props.children, (child) => {
    if (!React.isValidElement(child)) {
      return child
    }

    const newProps: TextInputProps = {
      nativeID: NATIVE_ID_KEYS.textInput,
    }

    return React.cloneElement(child, newProps as any)
  })

  return (
    <AixInputWrapperInternal
      {...props}
      onPaste={props.onPaste ? callback(props.onPaste) : undefined}
    >
      {childrenWithProps}
    </AixInputWrapperInternal>
  )
}
