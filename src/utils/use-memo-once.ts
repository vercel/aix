import { useMemo, useRef } from 'react'

export const useMemoOnce = __DEV__
  ? function useMemoOnce<T>(factory: () => T, deps: React.DependencyList | undefined): T {
      const executionCountRef = useRef(0)
      const prevDepsRef = useRef<React.DependencyList | undefined>(deps)

      return useMemo(() => {
        executionCountRef.current += 1

        if (executionCountRef.current > 2) {
          const changedDeps: number[] = []
          if (prevDepsRef.current && deps) {
            deps.forEach((dep, index) => {
              if (prevDepsRef.current![index] !== dep) {
                changedDeps.push(index)
              }
            })
          }

          console.warn(
            'useMemoOnce has executed more than twice. This may indicate unnecessary re-computations.',
            {
              executionCount: executionCountRef.current,
              changedDependencyIndexes:
                changedDeps.length > 0 ? changedDeps : 'all deps changed or deps array changed',
              deps,
            },
          )
        }

        prevDepsRef.current = deps
        return factory()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps!)
    }
  : useMemo
