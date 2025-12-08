import { useCallback, useRef, useEffect, useMemo } from 'react'

type CancellableCallback<T extends (...args: any[]) => void> = T & {
  cancel: () => void
}

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): {
  debouncedFn: (...args: Parameters<T>) => void
  cancelDebouncedCallback: () => void
} {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      clearTimeout(timeoutRef.current)

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  const cancel = useCallback(() => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = undefined
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return { debouncedFn, cancelDebouncedCallback: cancel }
}

export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): {
  throttledFn: (...args: Parameters<T>) => void
  cancelThrottledCallback: () => void
} {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const lastArgsRef = useRef<Parameters<T> | null>(null)

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallRef.current

      // Store the latest args for the trailing call
      lastArgsRef.current = args

      if (timeSinceLastCall >= delay) {
        // Enough time has passed, call immediately
        lastCallRef.current = now
        callback(...args)
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      } else if (!timeoutRef.current) {
        // Schedule a trailing call with the remaining time
        const remainingTime = delay - timeSinceLastCall
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          if (lastArgsRef.current) {
            callback(...lastArgsRef.current)
          }
          timeoutRef.current = undefined
        }, remainingTime)
      }
    },
    [callback, delay]
  )

  const cancel = useCallback(() => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = undefined
    lastArgsRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return { throttledFn, cancelThrottledCallback: cancel }
}
