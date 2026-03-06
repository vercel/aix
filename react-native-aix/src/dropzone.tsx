import type * as native from './dropzone.native'

export function AixDropzone(props: React.ComponentProps<typeof native.AixDropzone>) {
  return <>{props.children}</>
}
