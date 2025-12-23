import { useState, useRef, useEffect, useCallback } from 'react'

export function createUsePool(maxPoolSize?: number) {
  // Use parallel arrays instead of one array for fast array operations
  const items: object[] = []
  const setters: ((value: boolean) => void)[] = []

  const removeItem = (item: object, setInactive?: boolean) => {
    const index = items.indexOf(item)
    if (index !== -1) {
      if (setInactive) {
        setters[index]!(false)
      }
      items.splice(index, 1)
      setters.splice(index, 1)
    }
  }

  const usePool = () => {
    // Use a stable object reference as the key
    const item = useRef({}).current
    const [isActive, setIsActive] = useState(true)

    // A function that is stable and only changes when the item changes
    const evict = useCallback(() => removeItem(item, true), [item])

    useEffect(() => {
      items.push(item)
      setters.push(setIsActive)

      // Evict oldest item if over capacity
      if (maxPoolSize && items.length > maxPoolSize) {
        items.shift()
        const evictedListener = setters.shift()!
        evictedListener(false)
      }

      // Remove from pool when unmounting
      return () => removeItem(item)
    }, [item])

    return { isActive, evict }
  }

  return usePool
}
