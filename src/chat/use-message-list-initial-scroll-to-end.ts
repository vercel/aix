import { useMessageListContext } from './message-list/context'
import { useInitialScrollToEnd } from './use-initial-scroll-to-end'

export function useMessageListInitialScrollToEnd({
  disabled = false,
}: {
  disabled?: boolean
} = {}) {
  const { blankSize, scrollToEnd } = useMessageListContext()

  return useInitialScrollToEnd(blankSize, scrollToEnd, !disabled)
}
