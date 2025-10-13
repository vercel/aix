import { useMessageListContext } from './context'
import { useAutoscrollFromComposerHeight } from './use-autoscroll-composer-height'

export function useScrollMessageListFromComposerSizeUpdates() {
  const { listRef, scrollToEnd } = useMessageListContext()

  return useAutoscrollFromComposerHeight(listRef, scrollToEnd)
}
