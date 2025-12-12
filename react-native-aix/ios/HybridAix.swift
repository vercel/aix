//
//  HybridAix.swift
//  Pods
//
//  Created by Fernando Rojo on 12/11/2025.
//

import Foundation
import UIKit
import ObjectiveC.runtime

private var aixContextKey: UInt8 = 0

/// Protocol that defines the Aix context interface for child views to communicate with
protocol AixContext: AnyObject {
    /// The blank view (last cell) - used for calculating blank size
    var blankView: HybridAixCellView? { get set }
    /// The composer view
    var composerView: HybridAixComposer? { get set }
    
    /// Called when the blank view's size changes
    func reportBlankViewSizeChange(size: CGSize, index: Int)
    
    /// Register a cell with the context
    func registerCell(_ cell: HybridAixCellView)
    
    /// Unregister a cell from the context
    func unregisterCell(_ cell: HybridAixCellView)
    
    /// Register the composer view
    func registerComposerView(_ composerView: HybridAixComposer)
    
    /// Unregister the composer view
    func unregisterComposerView(_ composerView: HybridAixComposer)
}

extension UIView {
    /// Get/set the Aix context associated with this view
    /// Uses OBJC_ASSOCIATION_ASSIGN to avoid retain cycles (weak reference behavior)
    var aixContext: AixContext? {
        get { objc_getAssociatedObject(self, &aixContextKey) as? AixContext }
        set { objc_setAssociatedObject(self, &aixContextKey, newValue, .OBJC_ASSOCIATION_ASSIGN) }
    }

    /// Walk up the view hierarchy to find the nearest AixContext
    func useAixContext() -> AixContext? {
        var node: UIView? = self
        while let current = node {
            if let ctx = current.aixContext {
                return ctx
            }
            node = current.superview
        }
        return nil
    }

    /// Recursively search subviews to find a UIScrollView
    func findScrollView() -> UIScrollView? {
        if let scrollView = self as? UIScrollView {
            return scrollView
        }
        for subview in subviews {
            if let scrollView = subview.findScrollView() {
                return scrollView
            }
        }
        return nil
    }
}

// MARK: - HybridAix (Root Context)

class HybridAix: HybridAixSpec, AixContext {
    
    // MARK: - Inner View
    
    /// Custom UIView that notifies owner when added to superview
    /// so we can attach the context to the parent component
    private final class InnerView: UIView {
        weak var owner: HybridAix?
        
        override func didMoveToSuperview() {
            super.didMoveToSuperview()
            owner?.handleDidMoveToSuperview()
        }
    }
    
    /// The root UIView that this context is attached to
    let view: UIView
    
    /// Current keyboard height (will be updated by keyboard events)
    var keyboardHeight: CGFloat = 0
    
    // MARK: - Props (from Nitro spec)
    var shouldStartAtEnd: Bool = true
    var scrollOnComposerSizeUpdate: Bool = false

    // MARK: - Private Types
    
    private struct QueuedScrollToEnd {
        var index: Int
        var animated: Bool
    }

    // MARK: - Private State
    
    /// Queued scroll operation waiting for blank view to update
    private var queuedScrollToEnd: QueuedScrollToEnd? = nil
    
    /// Registered cells - using NSMapTable for weak references to avoid retain cycles
    /// Key: cell index, Value: weak reference to cell
    private var cells = NSMapTable<NSNumber, HybridAixCellView>.weakToWeakObjects()
    
    // MARK: - Context References (weak to avoid retain cycles)
    
    weak var blankView: HybridAixCellView? = nil {
        didSet {
            // Could add observers or callbacks here when blank view changes
        }
    }
    
    weak var composerView: HybridAixComposer? = nil
    
    // MARK: - Computed Properties
    
    /// Find the scroll view within our view hierarchy
    var scrollView: UIScrollView? {
        let sv = view.findScrollView()
        print("[Aix] scrollView: \(String(describing: sv))")
        return sv
    }
    
    /// Height of the composer view
    private var composerHeight: CGFloat {
        return composerView?.view.bounds.height ?? 0
    }
    
    /// Calculate the blank size - the space needed to push content up
    /// so the last message can scroll to the top of the visible area
    var blankSize: CGFloat {
        let blankViewHeight = blankView?.view.bounds.height ?? 0
        
        guard let scrollView = scrollView else { return 0 }
        
        // The inset is: scrollable area height - blank view height - keyboard height
        // This ensures when scrolled to end, the last message is at the top
        let inset = scrollView.bounds.height - blankViewHeight - keyboardHeight
        
        return max(0, inset)
    }
    
    /// The content inset for the bottom of the scroll view
    var contentInsetBottom: CGFloat {
        return blankSize + keyboardHeight + composerHeight
    }
    
    // MARK: - Initialization
    
    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
        print("[Aix] HybridAix initialized, attaching context to view")
        // Attach this context to our inner view
        view.aixContext = self
    }
    
    // MARK: - Lifecycle
    
    /// Called when our view is added to the HybridAixComponent
    private func handleDidMoveToSuperview() {
        guard let superview = view.superview else { return }
        print("[Aix] View added to superview: \(type(of: superview)), attaching context")
        // Attach context to the superview (HybridAixComponent) so children can find it
        superview.aixContext = self
    }
    
    // MARK: - Public API (called from React Native)
    
    /// Request to scroll to end when the blank view at the given index updates
    /// This is called when the user sends a message and we want to scroll
    /// when the layout is ready
    func scrollToEndOnBlankSizeUpdate(index: Int) {
        // If the blank view is already at this index, scroll immediately
        if let blankView = blankView, index == Int(blankView.index) {
            scrollToEnd(animated: true)
        } else {
            // Otherwise queue the scroll for when the blank view updates
            queuedScrollToEnd = QueuedScrollToEnd(index: index, animated: true)
        }
    }
    
    // MARK: - AixContext Protocol
    
    func reportBlankViewSizeChange(size: CGSize, index: Int) {
        print("[Aix] reportBlankViewSizeChange: size=\(size), index=\(index)")
        // Check if we have a queued scroll waiting for this index
        if let queued = queuedScrollToEnd, index == queued.index {
            print("[Aix] Executing queued scrollToEnd for index \(index)")
            scrollToEnd(animated: queued.animated)
            queuedScrollToEnd = nil
        }
    }
    
    func registerCell(_ cell: HybridAixCellView) {
        cells.setObject(cell, forKey: NSNumber(value: cell.index))

        print("[Aix] registerCell: index=\(cell.index), isLast=\(cell.isLast)")
        
        // If this cell is marked as last, update our blank view reference
        if cell.isLast {
            print("[Aix] Setting blankView to cell at index \(cell.index)")
            blankView = cell
        }
    }
    
    func unregisterCell(_ cell: HybridAixCellView) {
        print("[Aix] unregisterCell: index=\(cell.index), isLast=\(cell.isLast)")
        cells.removeObject(forKey: NSNumber(value: cell.index))
        
        // If this was our blank view, clear it
        if blankView === cell {
            print("[Aix] Clearing blankView (was cell at index \(cell.index))")
            blankView = nil
        }
    }
    
    func registerComposerView(_ composerView: HybridAixComposer) {
        print("[Aix] registerComposerView: \(composerView)")
        self.composerView = composerView
    }
    
    func unregisterComposerView(_ composerView: HybridAixComposer) {
        print("[Aix] unregisterComposerView: \(composerView)")
        if self.composerView === composerView {
            self.composerView = nil
        }
    }
    
    // MARK: - Cell Access
    
    /// Get a cell by its index
    func getCell(index: Int) -> HybridAixCellView? {
        return cells.object(forKey: NSNumber(value: index))
    }
    
    /// Find the last cell (the one marked as isLast)
    func findLastCell() -> HybridAixCellView? {
        // Iterate through all cells to find the one marked as last
        let enumerator = cells.objectEnumerator()
        while let cell = enumerator?.nextObject() as? HybridAixCellView {
            if cell.isLast {
                return cell
            }
        }
        return nil
    }
    
    // MARK: - Scrolling
    
    /// Scroll the scroll view to the end (bottom)
    private func scrollToEnd(animated: Bool) {
        guard let scrollView = scrollView else { return }
        
        // Calculate the offset to show the bottom of content
        let bottomOffset = CGPoint(
            x: 0,
            y: max(0, scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom)
        )
        scrollView.setContentOffset(bottomOffset, animated: animated)
    }
    
    /// Queue a scroll to end, will execute when blank view at index is ready
    func queueScrollToEnd(index: Int, animated: Bool = true) {
        if let blankView = blankView, blankView.isLast && index == Int(blankView.index) {
            scrollToEnd(animated: animated)
        } else {
            queuedScrollToEnd = QueuedScrollToEnd(index: index, animated: animated)
        }
    }
}
