import { useEffect, useRef } from 'react'

export function createUseStaggered(delay: number) {
  const animationQueue: (() => void)[] = []
  let isProcessing = false

  const scheduleNext = () => {
    if (delay && delay > 0) {
      setTimeout(processNextAnimation, delay)
    } else {
      requestAnimationFrame(processNextAnimation)
    }
  }

  const processNextAnimation = () => {
    if (animationQueue.length === 0) {
      isProcessing = false
      return
    }

    const queueLength = animationQueue.length
    let animationsToProcess = 1

    if (queueLength > 10) {
      animationsToProcess = Math.min(5, Math.ceil(queueLength / 4))
    } else if (queueLength > 5) {
      animationsToProcess = 2
    }

    for (let i = 0; i < animationsToProcess && animationQueue.length > 0; i++) {
      const startAnimation = animationQueue.shift()
      startAnimation?.()
    }

    if (animationQueue.length > 0) {
      scheduleNext()
    } else {
      isProcessing = false
    }
  }

  const queueAnimation = (startFn: () => void) => {
    animationQueue.push(startFn)

    if (!isProcessing) {
      isProcessing = true
      scheduleNext()
    }
  }

  const useStaggered = (animationFn: () => void) => {
    const animationRef = useRef<(() => void) | null>(animationFn)

    useEffect(() => {
      if (animationRef.current) {
        queueAnimation(animationRef.current)
      }
    }, [])

    useEffect(() => {
      const animation = animationRef.current
      return () => {
        if (!animation) {
          return
        }

        const index = animationQueue.indexOf(animation)
        if (index !== -1) {
          animationQueue.splice(index, 1)
        }
      }
    }, [])
  }

  return useStaggered
}
