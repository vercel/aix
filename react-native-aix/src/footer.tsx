import type * as native from './footer.native'

export function AixFooter(props: React.ComponentProps<typeof native.AixFooter>) {
  return (
    <div {...(props as any)} data-aix-footer>
      {props.children}
    </div>
  )
}
