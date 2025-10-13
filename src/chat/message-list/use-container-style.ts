import {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { ViewStyle } from 'react-native'

export function useMessageListContainerStyle({
  ready,
  styleWorklet,
}: {
  ready: SharedValue<boolean>
  styleWorklet: ({ ready }: { ready: boolean }) => ViewStyle
}) {
  return useAnimatedStyle(() => {
    const isReady = ready.get()
    if (!styleWorklet) {
      return { opacity: withTiming(isReady ? 1 : 0, { duration: 150 }) }
    }
    return styleWorklet({ ready: isReady })
  })
}
