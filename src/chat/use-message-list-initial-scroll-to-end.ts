import { useMessageListContext } from './message-list/context'
import { useInitialScrollToEnd } from './use-initial-scroll-to-end'

export function useMessageListInitialScrollToEnd({
  numMessages,
}: {
  numMessages: number
}) {
  const { blankSize, scrollToEnd } = useMessageListContext()

  return useInitialScrollToEnd(blankSize, scrollToEnd, numMessages > 0)
}
