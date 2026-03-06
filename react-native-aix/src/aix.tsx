'use client'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type * as native from './aix.native'
import type { SharedValue } from 'react-native-reanimated'

export function Aix(props: React.ComponentProps<typeof native.Aix>) {
  const {
    scrollToIndex,
    scrollOnFooterSizeUpdate,
    onWillApplyContentInsets,
    onScrolledNearEndChange,
    onDidScrollToIndex,
    additionalContentInsets,
    additionalScrollIndicatorInsets,
    mainScrollViewID,
    shouldApplyContentInsets,
    shouldStartAtEnd,
    style,
    penultimateCellIndex,
    ...rest
  } = props

  const ref = useRef<HTMLDivElement>(null)

  const didScrollInitiallyForId = useRef<string | null>(null)
  useEffect(
    function scrollInitially() {
      if (!shouldStartAtEnd) return
      const id = resolveSharedValue(mainScrollViewID)
      if (!id) return
      if (didScrollInitiallyForId.current === id) return
      if (!ref.current) return

      const scrollView = getScrollView(ref.current, id)
      if (!scrollView) return

      const blankSize = calculateBlankSize()
      applyBlankSizeChange(blankSize)

      scrollView.scrollTo({
        top: scrollView.scrollHeight - blankSize,
        behavior: 'instant',
      })

      didScrollInitiallyForId.current = id
    },
    [mainScrollViewID],
  )

  const cellHeights = useRef<Record<number, number>>({})

  const applyBlankSizeChange = useCallback((blankSize: number) => {
    const scrollView = getScroll()
    if (!scrollView) return

    scrollView.style.paddingBottom = `${blankSize}px`
  }, [])

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const measureCells = () => {
      const cells = root.querySelectorAll('[data-aix-cell]')
      const next: Record<number, number> = {}
      let didChange = false
      cells.forEach((cell) => {
        const index = parseInt(cell.getAttribute('data-aix-cell') ?? '-1')
        if (index < 0) return
        next[index] = cell.getBoundingClientRect().height
        if (cellHeights.current[index] !== next[index]) {
          didChange = true
        }
      })
      cellHeights.current = next
      if (didChange) {
        const blankSize = calculateBlankSize()
        applyBlankSizeChange(blankSize)
      }
    }

    measureCells()

    const observedCells = new Set<Element>()
    const resizeObserver = new ResizeObserver(measureCells)

    const syncObservedCells = () => {
      const currentCells = new Set(root.querySelectorAll('[data-aix-cell]'))
      for (const cell of observedCells) {
        if (!currentCells.has(cell)) {
          resizeObserver.unobserve(cell)
          observedCells.delete(cell)
        }
      }
      for (const cell of currentCells) {
        if (!observedCells.has(cell)) {
          resizeObserver.observe(cell)
          observedCells.add(cell)
        }
      }
    }

    syncObservedCells()

    const mutationObserver = new MutationObserver(() => {
      syncObservedCells()
      measureCells()
    })
    mutationObserver.observe(root, { childList: true, subtree: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  const stableOnDidScrollToIndex = useStableCallback(() => onDidScrollToIndex?.())

  const getScroll = useCallback(() => {
    if (!ref.current) return null
    const mainScrollViewIDValue = resolveSharedValue(mainScrollViewID)
    if (!mainScrollViewIDValue) return null
    const scrollView = getScrollView(ref.current, mainScrollViewIDValue)
    if (!scrollView) return null
    return scrollView
  }, [mainScrollViewID])

  const getBlankView = useCallback(() => {
    const scrollView = getScroll()
    if (!scrollView) return null

    const view = scrollView.querySelector(`[data-aix-cell-last="true"]`)
    if (!view) return null
    const index = parseInt(view.getAttribute('data-aix-cell') ?? '-1')
    if (isNaN(index)) return null
    if (index < 0) return null

    return { view, index }
  }, [getScroll])

  const getCellsBeforeBlankView = useCallback(() => {
    const blankView = getBlankView()
    if (!blankView) return null

    const { index } = blankView
    if (!ref.current) return null

    const cells = Array.from(ref.current.querySelectorAll(`[data-aix-cell]`))
    const penultimateIndex = resolveSharedValue(penultimateCellIndex)

    if (penultimateIndex == null) return null

    let sinceIndex = penultimateIndex ?? index - 1

    let cellsBeforeBlankView: ({ cell: Element } & { height: number })[] = []

    let totalHeight = 0
    for (let i = sinceIndex; i < index; i++) {
      let cell = cells.find((cell) => parseInt(cell.getAttribute('data-aix-cell') ?? '-1') === i)

      if (!cell) continue

      const height = cell.getBoundingClientRect().height
      cellsBeforeBlankView.push({ cell, height })
      totalHeight += height
    }

    return { cellsBeforeBlankView, totalHeight }
  }, [getBlankView])

  const calculateBlankSize = useCallback(() => {
    const scrollView = getScroll()

    if (!scrollView) return 0

    const scrollContainerHeight = scrollView.getBoundingClientRect().height

    const blankView = getBlankView()
    if (!blankView) return 0

    const beforeBlankView = getCellsBeforeBlankView()
    if (!beforeBlankView) return 0

    const blankSize =
      scrollContainerHeight -
      beforeBlankView.totalHeight -
      blankView.view.getBoundingClientRect().height

    return Math.max(0, blankSize)
  }, [getScroll])

  useEffect(
    function scroll() {
      if (!ref.current) return
      const mainScrollViewIDValue = resolveSharedValue(mainScrollViewID)
      if (!mainScrollViewIDValue) return
      const scrollToIndexValue = resolveSharedValue(scrollToIndex)
      if (scrollToIndexValue == null) return
      if (scrollToIndexValue < 0) return

      const scrollView = getScrollView(ref.current, mainScrollViewIDValue)
      if (!scrollView) return

      const aixItemToScrollTo = ref.current.querySelector(`[data-aix-cell="${scrollToIndexValue}"]`)
      if (!aixItemToScrollTo) return

      const scrollViewRect = scrollView.getBoundingClientRect()
      const itemRect = aixItemToScrollTo.getBoundingClientRect()
      const scrollToPosition = itemRect.top - scrollViewRect.top + scrollView.scrollTop

      scrollView.scrollTo({
        top: scrollToPosition,
        behavior: 'smooth',
      })

      stableOnDidScrollToIndex.current?.()
    },
    [mainScrollViewID, scrollToIndex],
  )

  return <div {...(rest as any)} ref={ref} />
}

function useStableCallback<T extends (...args: any[]) => any>(callback: T) {
  const ref = useRef(callback)
  useEffect(
    function updateStableCallback() {
      ref.current = callback
    },
    [callback],
  )
  return ref
}

function getScrollView(parent: HTMLElement, id: string) {
  return parent.querySelector(`#${id}`) as HTMLDivElement | null
}

function resolveSharedValue<T>(value: T | SharedValue<T>): T {
  return value && typeof value === 'object' && 'get' in value ? value.get() : value
}
