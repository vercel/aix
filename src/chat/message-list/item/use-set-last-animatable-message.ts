import { useLayoutEffect } from 'react'
import { useMessageListContext } from '../context'

// can we just get rid of this?
export function useSetLastUserMessage({
  lastUserMessageIndex,
  getPositionByIndex,
}: {
  lastUserMessageIndex: number
  getPositionByIndex?: (index: number) => number
}) {
  const { getListState, lastUserMessage } = useMessageListContext()

  useLayoutEffect(() => {
    const position = getPositionByIndex
      ? getPositionByIndex(lastUserMessageIndex)
      : getListState()?.positionAtIndex(lastUserMessageIndex)

    if (position != null) {
      lastUserMessage.set({ index: lastUserMessageIndex, position })
    }
  }, [lastUserMessageIndex, getListState, lastUserMessage])
}
