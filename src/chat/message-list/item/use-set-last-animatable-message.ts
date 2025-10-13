import { useLayoutEffect } from 'react'
import { useMessageListContext } from '../context'

export function useSetLastAnimatableMessage({
  messageIndex,
  getPositionByIndex,
  getDataLength,
  getIsLastAnimatableMessage = fallbackGetIsLastAnimatableMessage,
}: {
  messageIndex: number
  getPositionByIndex?: (index: number) => number
  getDataLength?: () => number
  getIsLastAnimatableMessage?: typeof fallbackGetIsLastAnimatableMessage
}) {
  const { getListState, lastUserMessage } = useMessageListContext()

  useLayoutEffect(() => {
    const position = getPositionByIndex
      ? getPositionByIndex(messageIndex)
      : getListState()?.positionAtIndex(messageIndex)

    if (position != null) {
      const lastIndex = lastUserMessage.get().index
      const numMessages = getDataLength
        ? getDataLength()
        : getListState()?.data.length

      const isLastAnimatableMessage = getIsLastAnimatableMessage({
        messageIndex,
        dataLength: numMessages ?? 0,
        lastIndex,
      })

      if (isLastAnimatableMessage) {
        lastUserMessage.set({ index: messageIndex, position })
      }
    }
  }, [messageIndex, getListState, lastUserMessage])
}

function fallbackGetIsLastAnimatableMessage({
  messageIndex,
  dataLength,
  lastIndex,
}: {
  messageIndex: number
  dataLength: number
  lastIndex: number
}) {
  // Set lastUserMessage if it's one of the last 2 messages because
  // a system message may be below it
  return dataLength && messageIndex > lastIndex && messageIndex > dataLength - 3
}
