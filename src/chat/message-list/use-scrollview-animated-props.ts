import { useAnimatedProps } from 'react-native-reanimated'
import { useMessageListContext } from './context'
import { useComposerHeightContext } from '../composer/composer-height-context'

export function useScrollViewAnimatedProps({
  bottomInsetPadding = 0,
}: {
  bottomInsetPadding?: number
}) {
  const { translateY, offsetY, bottomInset, showScrollIndicator } =
    useMessageListContext()
  const { composerHeight } = useComposerHeightContext()

  return useAnimatedProps(() => {
    const scrollIndicatorInsetsBottom =
      composerHeight.get() + translateY.get() + bottomInsetPadding
    return {
      contentOffset: {
        x: 0,
        y: offsetY.get(),
      },
      contentInset: {
        left: 0,
        top: 0,
        right: 0,
        bottom: bottomInset.get(),
      },
      scrollIndicatorInsets: {
        top: 0,
        bottom: Number.isFinite(scrollIndicatorInsetsBottom)
          ? Math.max(0, scrollIndicatorInsetsBottom)
          : 0,
      },
      showsVerticalScrollIndicator: showScrollIndicator.get(),
    }
  }, [
    composerHeight,
    translateY,
    bottomInset,
    bottomInsetPadding,
    showScrollIndicator,
    offsetY,
  ])
}
