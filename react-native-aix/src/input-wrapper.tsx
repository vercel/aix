import type * as native from './input-wrapper.native'

export function AixInputWrapper(props: React.ComponentProps<typeof native.AixInputWrapper>) {
  return <div {...(props as any)} data-aix-input-wrapper />
}
