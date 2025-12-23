import { useEffect, useRef } from 'react'

// Creates a staggered animation system - only one animation starts per frame/delay
export function createUseStaggered(delay: number) {
  const animationQueue: (() => void)[] = []
  let isProcessing = false

  // Schedule next animation with delay or requestAnimationFrame
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

    // Calculate how many animations to process this cycle
    const queueLength = animationQueue.length
    let animationsToProcess = 1

    // Catch-up logic: process more animations when queue is long
    if (queueLength > 10) {
      animationsToProcess = Math.min(5, Math.ceil(queueLength / 4))
    } else if (queueLength > 5) {
      animationsToProcess = 2
    }

    // Process the calculated number of animations
    for (let i = 0; i < animationsToProcess && animationQueue.length > 0; i++) {
      const startAnimation = animationQueue.shift()!
      startAnimation()
    }

    // Continue processing or mark as idle
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

    // Queue animation on mount
    useEffect(() => {
      if (animationRef.current) {
        queueAnimation(animationRef.current)
      }
    }, [])

    useEffect(() => {
      const animation = animationRef.current
      return () => {
        // Clean up pending animation on unmount
        if (animation) {
          const index = animationQueue.indexOf(animation)
          if (index !== -1) {
            animationQueue.splice(index, 1)
          }
        }
      }
    }, [])
  }

  return useStaggered
}
