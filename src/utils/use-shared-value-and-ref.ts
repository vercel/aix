import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useCallback, useMemo, useRef } from 'react'

export interface SharedValueAndRef<T> {
  ref: React.RefObject<T>
  set: (value: T) => void
  sharedValue: SharedValue<T>
}

export function useSharedValueAndRef<T>(value: T): SharedValueAndRef<T> {
  const sharedValue = useSharedValue<T>(value)
  const ref = useRef<T>(value)

  const set = useCallback(
    (newValue: T) => {
      ref.current = newValue
      sharedValue.set(newValue)
    },
    [sharedValue, ref]
  )

  return useMemo(() => ({ ref, set, sharedValue }), [ref, set, sharedValue])
}
