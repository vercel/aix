import type * as native from './cell.native'

export function AixCell({ index, isLast, ...props }: React.ComponentProps<typeof native.AixCell>) {
  return <div {...(props as any)} data-aix-cell={index} data-aix-cell-last={isLast} />
}
