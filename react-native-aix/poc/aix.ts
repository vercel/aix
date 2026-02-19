// @ts-nocheck

// prompt for AI plan mode:
/**
 * This file is a proof of concept for the Aix library.
 *
 * We are going to implement it in UIKit, but for now I'm using TS since I don't love Swift as a TS dev.
 */

class Aix extends AixContext {
  // props
  shouldStartAtEnd: boolean
  scrollOnComposerSizeUpdate: boolean

  constructor({
    shouldStartAtEnd = true,
    scrollOnComposerSizeUpdate = true,
    minimumUserMessageHeight = 0,
  }: {
    shouldStartAtEnd?: boolean
    scrollOnComposerSizeUpdate?: boolean
    minimumUserMessageHeight: number
  }) {
    this.shouldStartAtEnd = shouldStartAtEnd
    this.scrollOnComposerSizeUpdate = scrollOnComposerSizeUpdate
  }

  get composerView() {
    return this.findSubviewOfType(this.view, AixComposerView)
  }

  private findSubviewOfType<T extends UIView>(
    view: UIView,
    type: new () => T
  ): T | null {
    let queue = view.subviews
    // breadth-first search
    while (queue.length) {
      const subview = queue.shift()
      if (subview instanceof type) {
        return subview
      }
      queue.push(...subview.subviews)
    }
    return null
  }

  get scrollView() {
    return this.findSubviewOfType(this.view, UIScrollView)
  }

  get composerHeight() {
    return this.composerView.bounds.height
  }

  get contentInsetBottom() {
    return this.blankSize + this.keyboardHeight + this.composerHeight
  }

  get blankSize() {
    const blankView = this.blankView?.deref()

    if (!blankView) {
      return 0
    }

    const inset =
      this.scrollView.bounds.height -
      blankView.bounds.height -
      this.keyboardHeight

    return Math.max(0, inset)
  }

  queuedScrollToEnd = null

  queueScrollToEnd(index, animated = true) {
    if (this.blankView?.isLast && index === this.blankView.index) {
      this.scrollToEnd(animated)
    } else {
      this.queuedScrollToEnd = { index, animated }
    }
  }

  scrollToEnd(animated = true) {
    this.scrollView.setContentOffset(
      {
        x: 0,
        y: Math.max(
          0,
          this.scrollView.contentSize.height -
            this.scrollView.bounds.height +
            this.contentInsetBottom
        ),
      },
      animated
    )
  }

  // ref methods
  // consumers will call this when they send a message
  // indicating they want to scroll when the time is right and blank size is set
  scrollToEndOnBlankSizeUpdate(index) {
    if (this.blankView?.index === index) {
      this.scrollToEnd(true)
    } else {
      this.queuedScrollToEnd = { index, animated: true }
    }
  }

  // internal methods

  keyboardHeight: number
  constructor() {
    this.keyboardHeight =
      UIManager.getViewManagerConfig('KeyboardController').initialKeyboardHeight
  }

  startEvent: null | {
    scrollY: number
    isOpening: boolean
    isInteractive: boolean
    targetContentOffsetY: number | null
    shouldCollapseBlankSize: boolean
  } = null

  private onKeyboardStart(event) {
    const isOpening = event.progress === 1
    function calculateTargetContentOffsetY(): number | null {}
    this.startEvent = {
      scrollY: this.scrollView.contentOffset.y,
      isOpening,
      isInteractive: event.isInteractive,
      targetContentOffsetY: calculateTargetContentOffsetY(),
      shouldCollapseBlankSize: false,
    }
  }
  private onKeyboardMove(event) {
    this.keyboardHeight = event.endCoordinates.height * event.progress

    if (this.startEvent?.targetContentOffsetY !== null) {
      const y = this.startEvent.targetContentOffsetY * event.progress
      this.scrollView.setContentOffset(
        {
          x: 0,
          y,
        },
        false
      )
    }
  }
  private onKeyboardEnd(event) {
    this.startEvent = null
  }

  get blankView() {
    const lastCell = Array.from(this.cells.values()).findLast((c) => c.isLast)

    if (lastCell) {
      return lastCell
    }

    return null
  }

  // we just want to indicate to swift that this is a weak reference
  private cells: Map<number, WeakRef<AixCell>> = new Map()

  public registerCell(cell: AixCell) {
    this.cells.set(cell.index, cell)
  }

  public unregisterCell(cell: AixCell) {
    this.cells.delete(cell.index)
  }

  public getCell(index: number) {
    return this.cells.get(index)?.deref()
  }

  public registerComposerView(composerView: AixComposerView) {
    this.composerView = composerView
  }

  public unregisterComposerView(composerView: AixComposerView) {
    this.composerView = null
  }
}

class AixCell extends UIView {
  index: number
  isLast: boolean
  constructor(index, isLast) {
    super()
    this.index = index
    this.isLast = isLast

    this.useAixContext().registerCell(this)
  }

  // on mount
  // we are pretending this is UIKIt

  layoutSubviews() {
    super.layoutSubviews()

    this.useAixContext().registerCell(this)
  }
}

class AixComposerView extends UIView {
  constructor() {
    super()
    this.useAixContext().registerComposerView(this)
  }

  // on unmount in UIKit

  dealloc() {
    super.dealloc()
    this.useAixContext().unregisterComposerView(this)
  }
}
