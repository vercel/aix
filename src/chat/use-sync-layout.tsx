import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  type LayoutRectangle,
  View,
} from 'react-native'

export function useSyncLayoutHeight<T extends View = View>(
  debounce?: number | undefined
) {
  const ref = useRef<T | null>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [height, setHeight] = useState(0)

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height

      if (debounce === undefined) {
        setHeight(height)
      } else {
        // Clear previous timeout if it exists
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current)
        }

        // Debounce the setViewHeight call
        debounceTimeoutRef.current = setTimeout(() => {
          debounceTimeoutRef.current = null
          setHeight(height)
        }, debounce)
      }
    },
    [debounce]
  )

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.measure((_, __, ___, height) => {
        setHeight(height)
      })
    }
  }, [])

  return { height, onLayout, ref }
}

export function useSyncLayoutHandler<T extends View = View>(
  onLayout: (layout: LayoutRectangle) => void
) {
  const ref = useRef<T>(null as any)

  const onLayout_ = useCallback(
    (event: LayoutChangeEvent) => {
      const layout = event.nativeEvent.layout
      onLayout(layout)
    },
    [onLayout]
  )

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.measure((x, y, width, height) => {
        onLayout({ x, y, width, height })
      })
    }
  }, [onLayout])

  return { onLayout: onLayout_, ref }
}
