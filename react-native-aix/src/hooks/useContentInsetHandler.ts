import { useCallback } from 'react'
import type { AixContentInsets } from '../views/aix.nitro'

/**
 * Hook that creates a stable callback handler for content inset updates.
 * Use this with `onWillApplyContentInsets` prop to receive inset updates.
 *
 * @example
 * ```tsx
 * const bottomInset = useSharedValue<number | null>(null)
 *
 * const contentInsetHandler = useContentInsetHandler((insets) => {
 *   bottomInset.value = insets.bottom ?? null
 * })
 *
 * <Aix
 *   shouldApplyContentInsets={false}
 *   onWillApplyContentInsets={contentInsetHandler}
 * />
 * ```
 */
export function useContentInsetHandler(
  handler: (insets: AixContentInsets) => void,
  dependencies: unknown[] = []
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(handler, dependencies)
}
