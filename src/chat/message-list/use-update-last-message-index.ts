import { useMessageListContext } from './context'
import { useLayoutEffect } from 'react'

export function useUpdateLastMessageIndex({
  numMessages,
}: {
  numMessages: number
}) {
  const { lastMessageIndex } = useMessageListContext()

  useLayoutEffect(() => {
    lastMessageIndex.set((numMessages || 0) - 1)
  }, [numMessages, lastMessageIndex])
}
