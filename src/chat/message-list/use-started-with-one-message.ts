import { useLayoutEffect } from 'react'
import { useMessageListContext } from './context'

export function useStartedWithOneMessage({
  didStartWithOneMessage,
}: {
  didStartWithOneMessage: boolean
}) {
  const { startedWithOneMessage } = useMessageListContext()

  useLayoutEffect(() => {
    // Only set true if the first observed length is exactly 1
    if (!startedWithOneMessage.get() && didStartWithOneMessage) {
      startedWithOneMessage.set(true)
    }
  }, [didStartWithOneMessage, startedWithOneMessage])
}
