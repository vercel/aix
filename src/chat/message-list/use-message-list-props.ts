import { LegendListRef } from "@legendapp/list";
import { useMessageListContext } from "./context";
import { useScrollViewAnimatedProps } from "./use-scrollview-animated-props";
import type { AnimatedLegendList } from "@legendapp/list/reanimated";

export function useMessageListProps({
  bottomInsetPadding,
}: {
  bottomInsetPadding?: number;
} = {}) {
  const { listRef, onContentSizeChange, onScroll } = useMessageListContext();
  return {
    animatedProps: useScrollViewAnimatedProps({ bottomInsetPadding }),
    ref: listRef as React.RefObject<LegendListRef>,
    onContentSizeChange,
    onScroll,
    maintainVisibleContentPosition: true,
  } satisfies Partial<React.ComponentPropsWithRef<typeof AnimatedLegendList>>;
}
