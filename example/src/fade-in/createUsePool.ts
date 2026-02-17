import { useCallback, useEffect, useRef, useState } from 'react'

export function createUsePool(maxPoolSize?: number) {
  const items: object[] = []
  const setters: ((value: boolean) => void)[] = []

  const removeItem = (item: object, setInactive?: boolean) => {
    const index = items.indexOf(item)
    if (index !== -1) {
      if (setInactive) {
        setters[index]?.(false)
      }

      items.splice(index, 1)
      setters.splice(index, 1)
    }
  }

  const usePool = () => {
    const item = useRef({}).current
    const [isActive, setIsActive] = useState(true)
    const evict = useCallback(() => removeItem(item, true), [item])

    useEffect(() => {
      items.push(item)
      setters.push(setIsActive)

      if (maxPoolSize && items.length > maxPoolSize) {
        items.shift()
        const evictedListener = setters.shift()
        evictedListener?.(false)
      }

      return () => removeItem(item)
    }, [item])

    return { isActive, evict }
  }

  return usePool
}
