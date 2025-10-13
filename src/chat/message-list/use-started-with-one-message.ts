import { useLayoutEffect } from 'react'
import { useMessageListContext } from './context'

export function useStartedWithOneMessage({
  numMessages,
}: {
  numMessages: number
}) {
  const { startedWithOneMessage } = useMessageListContext()

  useLayoutEffect(() => {
    // Only set true if the first observed length is exactly 1
    if (!startedWithOneMessage.get() && numMessages === 1) {
      startedWithOneMessage.set(true)
    }
  }, [numMessages, startedWithOneMessage])
}
