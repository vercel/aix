import { useMessageListContext } from './context'
import type Animated from 'react-native-reanimated'

export function useMessageListContainerProps() {
  const { onOuterLayout, refOuter } = useMessageListContext()

  return {
    onLayout: onOuterLayout,
    ref: refOuter,
  } satisfies React.ComponentPropsWithRef<typeof Animated.View>
}
