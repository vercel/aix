import type * as native from './cell.native'

export function AixCell(props: React.ComponentProps<typeof native.AixCell>) {
  return <div {...(props as any)} data-aix-cell={props.index} data-aix-cell-last={props.isLast} />
}
