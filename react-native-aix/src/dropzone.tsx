import type * as native from './dropzone.native'

export function AixDropzone(props: React.ComponentProps<typeof native.AixDropzone>) {
  return <div {...(props as any)} data-aix-dropzone />
}
