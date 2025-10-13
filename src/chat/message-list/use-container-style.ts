import {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { ViewStyle } from 'react-native'

export function useMessageListContainerStyle({
  hasScrolledToEnd,
  styleWorklet,
}: {
  hasScrolledToEnd: SharedValue<boolean>
  styleWorklet: ({ ready }: { ready: boolean }) => ViewStyle
}) {
  return useAnimatedStyle(() => {
    const ready = hasScrolledToEnd.get()
    if (!styleWorklet) {
      return { opacity: withTiming(ready ? 1 : 0, { duration: 150 }) }
    }
    return styleWorklet({ ready })
  })
}
