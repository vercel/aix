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
    

    private var didScrollToEndInitially = false
    
    // MARK: - Inner View
    
    /// Custom UIView that notifies owner when added to superview
    /// so we can attach the context to the parent component
    private final class InnerView: UIView {
        weak var owner: HybridAix?
        
        override func didMoveToSuperview() {
            super.didMoveToSuperview()
            owner?.handleDidMoveToSuperview()
        }
        
        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
            // Never claim to contain any points - let touches pass through
            return false
        }
    }
    
    /// The root UIView that this context is attached to
    let view: UIView
    
    /// Current keyboard height (will be updated by keyboard events)
    var keyboardHeight: CGFloat = 0
    var keyboardHeightWhenOpen: CGFloat = 0
    
    // MARK: - Props (from Nitro spec)
    var shouldStartAtEnd: Bool = true
    var scrollOnComposerSizeUpdate: Bool = false
    var scrollEndReachedThreshold: Double? = 200

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
    
    /// Cached scroll view reference (weak to avoid retain cycles)
    private weak var cachedScrollView: UIScrollView?
    
    /// Flag to track if we've set up the pan gesture observer
    private var didSetupPanGestureObserver = false
    
    /// Flag to track if we're currently in an interactive keyboard dismiss
    private var isInInteractiveDismiss = false
    
    // MARK: - Context References (weak to avoid retain cycles)
    
    weak var blankView: HybridAixCellView? = nil {
        didSet {
            // Could add observers or callbacks here when blank view changes
        }
    }
    
    weak var composerView: HybridAixComposer? = nil
    
    // MARK: - Computed Properties
    
    /// Find the scroll view within our view hierarchy
    /// We search from the superview (HybridAixComponent) since the scroll view
    /// is a sibling of our inner view, not a child
    var scrollView: UIScrollView? {
        if let cached = cachedScrollView {
            return cached
        }
        let searchRoot = view.superview ?? view
        let sv = searchRoot.findScrollView()
        cachedScrollView = sv
        print("[Aix] scrollView found: \(String(describing: sv))")
        
        // Set up pan gesture observer when we find the scroll view
        if sv != nil && !didSetupPanGestureObserver {
            setupPanGestureObserver()
        }
        
        return sv
    }
    
    /// Set up observer on scroll view's pan gesture to detect interactive keyboard dismiss
    private func setupPanGestureObserver() {
        guard let scrollView = cachedScrollView else { return }
        didSetupPanGestureObserver = true
        
        scrollView.panGestureRecognizer.addTarget(self, action: #selector(handlePanGesture(_:)))
        print("[Aix] Pan gesture observer set up")
    }
    
    /// Handle pan gesture state changes to detect interactive keyboard dismiss
    @objc private func handlePanGesture(_ gesture: UIPanGestureRecognizer) {
        guard let scrollView = cachedScrollView,
              scrollView.keyboardDismissMode == .interactive,
              keyboardHeight > 0 else { return }
        
        switch gesture.state {
        case .began, .changed:
            let velocity = gesture.velocity(in: scrollView)
            
            // User is scrolling down (positive velocity.y) while keyboard is visible
            if velocity.y > 0 && !isInInteractiveDismiss {
                print("[Aix] Interactive keyboard dismiss detected! velocity.y=\(velocity.y)")
                startInteractiveKeyboardDismiss()
            }
            
        case .ended, .cancelled, .failed:
            if isInInteractiveDismiss {
                print("[Aix] Interactive gesture ended")
                // The keyboard manager will handle the end via notifications
            }
            
        default:
            break
        }
    }
    
    /// Start tracking an interactive keyboard dismiss
    private func startInteractiveKeyboardDismiss() {
        guard !isInInteractiveDismiss else { return }
        isInInteractiveDismiss = true
        
        let scrollY = scrollView?.contentOffset.y ?? 0
        
        print("[Aix] Starting interactive keyboard dismiss from height=\(keyboardHeight)")
        
        startEvent = KeyboardStartEvent(
            scrollY: scrollY,
            isOpening: false,
            isInteractive: true,
            interpolateContentOffsetY: (scrollY, scrollY - 100),
            shouldCollapseBlankSize: false
        )
    }
    
    /// Height of the composer view
    private var composerHeight: CGFloat {
        return composerView?.view.bounds.height ?? 0
    }
    
    /// Calculate the blank size - the space needed to push content up
    /// so the last message can scroll to the top of the visible area
    var blankSize: CGFloat {
        guard let scrollView, let blankView else { return 0 }
        
        let cellBeforeBlankView = getCell(index: Int(blankView.index) - 1)
        let cellBeforeBlankViewHeight = cellBeforeBlankView?.view.frame.height ?? 0
        let blankViewHeight = blankView.view.frame.height
        
        
        // The inset is: scrollable area height - blank view height - keyboard height
        // This ensures when scrolled to end, the last message is at the top
        let inset = scrollView.bounds.height - blankViewHeight - cellBeforeBlankViewHeight - keyboardHeight

        print("[Aix][blankSize] inset=\(inset)")
        print("[Aix][blankSize] cellBeforeBlankViewHeight=\(cellBeforeBlankViewHeight)")
        print("[Aix][blankSize] blankViewHeight=\(blankViewHeight)")
        print("[Aix][blankSize] keyboardHeight=\(keyboardHeight)")
        
        return max(0, inset)
    }
    
    /// The content inset for the bottom of the scroll view
    var contentInsetBottom: CGFloat {
        return blankSize + keyboardHeight + composerHeight
    }
    
    /// Apply the current content inset to the scroll view
    func applyContentInset() {
        guard let scrollView = scrollView else { return }
        let inset = contentInsetBottom
        print("[Aix] Applying contentInset.bottom = \(inset)")
        scrollView.contentInset.bottom = inset
        scrollView.verticalScrollIndicatorInsets.bottom = inset
    }
    
    // MARK: - Keyboard Manager
    
    private lazy var keyboardManager: KeyboardManager = {
        let manager = KeyboardManager()
        manager.delegate = self
        return manager
    }()
    
    /// Event captured at the start of a keyboard transition
    private struct KeyboardStartEvent {
        let scrollY: CGFloat
        let isOpening: Bool
        var isInteractive: Bool
        let interpolateContentOffsetY: (CGFloat, CGFloat)?
        let shouldCollapseBlankSize: Bool
    }
    
    /// Current keyboard start event (nil when no keyboard transition is active)
    private var startEvent: KeyboardStartEvent? = nil
    
    // MARK: - Initialization
    
    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
        print("[Aix] HybridAix initialized, attaching context to view")
        // Attach this context to our inner view
        view.aixContext = self
        
        // Initialize keyboard manager (lazy, will start observing)
        _ = keyboardManager
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
        if let blankView, index == Int(blankView.index) {
            scrollToEnd(animated: true)
        } else {
            // Otherwise queue the scroll for when the blank view updates
            queuedScrollToEnd = QueuedScrollToEnd(index: index, animated: true)
        }
    }
    
    // MARK: - AixContext Protocol

    private var lastReportedBlankViewSize = (size: CGSize.zero, index: 0)
    
    func reportBlankViewSizeChange(size: CGSize, index: Int) {
        let didAlreadyUpdate = size.height == lastReportedBlankViewSize.size.height && size.width == lastReportedBlankViewSize.size.width && index == lastReportedBlankViewSize.index
        if didAlreadyUpdate {
            print("[Aix] [reportBlankViewSizeChange][duplicate]: size=\(size), index=\(index)")
            return
        }

        lastReportedBlankViewSize = (size: size, index: index)

        print("[Aix] reportBlankViewSizeChange: size=\(size), index=\(index) - updating")
        
        // Update scroll view insets
        applyContentInset()
        
        // Check if we have a queued scroll waiting for this index
        if let queued = queuedScrollToEnd, index == queued.index {
            print("[Aix] Executing queued scrollToEnd for index \(index)")
            scrollToEnd(animated: queued.animated)
            queuedScrollToEnd = nil
        } else if !didScrollToEndInitially {
            scrollToEnd(animated: false)
            didScrollToEndInitially = true
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
        print("[Aix] scrolling to end: bottomOffset=\(bottomOffset)")
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

// MARK: - KeyboardManagerDelegate

extension HybridAix: KeyboardManagerDelegate {
    func keyboardManager(_ manager: KeyboardManager, didUpdateHeight height: CGFloat, progress: CGFloat) {
        print("[Aix][delegate] Keyboard progress: \(progress), height: \(height) startEvent \(startEvent?.scrollY)")
        
        keyboardHeight = height
        applyContentInset()

        if let (startY, endY) = startEvent?.interpolateContentOffsetY {
            let newScrollY = startY + (endY - startY) * progress
            scrollView?.setContentOffset(CGPoint(x: 0, y: newScrollY), animated: false)
        }
        
        
        // TODO: Interpolate scroll position if startEvent?.targetContentOffsetY is set
    }
    
    func keyboardManagerDidStartAnimation(_ manager: KeyboardManager, event: KeyboardManager.KeyboardEvent) {
        print("[Aix] Keyboard started: isOpening=\(event.isOpening), target=\(event.targetHeight), alreadyInteractive=\(isInInteractiveDismiss)")

        // Capture the target height when keyboard is opening - this is a snapshot, not reactive to each frame
        if event.isOpening {
            keyboardHeightWhenOpen = event.targetHeight
            print("[Aix] Set keyboardHeightWhenOpen=\(keyboardHeightWhenOpen)")
        }

        // If we're already in an interactive dismiss (detected via pan gesture),
        // don't overwrite the event - just log and return
        if isInInteractiveDismiss && !event.isOpening {
            print("[Aix] Keyboard notification received during interactive dismiss - keeping existing event")
            return
        }
        
        // Detect interactive dismissal by checking if:
        // 1. Keyboard is closing (not opening)
        // 2. Scroll view has interactive keyboard dismiss mode
        // 3. User is actively scrolling (pan gesture is in progress)
        var isInteractive = event.isInteractive || isInInteractiveDismiss
        
        if !event.isOpening && !isInteractive {
            isInteractive = isInteractiveDismissInProgress()
        }
        
        print("[Aix] Keyboard started: isInteractive=\(isInteractive)")

        let scrollY = scrollView?.contentOffset.y ?? 0

        startEvent = KeyboardStartEvent(
            scrollY: scrollY,
            isOpening: event.isOpening,
            isInteractive: isInteractive,
            interpolateContentOffsetY: calculateInterpolateContentOffsetY(isOpening: event.isOpening, scrollY: scrollY),
            shouldCollapseBlankSize: false
        )
    }
    
    /// Check if an interactive keyboard dismiss is in progress by examining scroll view state
    private func isInteractiveDismissInProgress() -> Bool {
        guard let scrollView = scrollView else { return false }
        
        // Check if scroll view has interactive keyboard dismiss mode
        guard scrollView.keyboardDismissMode == .interactive else { return false }
        
        // Check if pan gesture is active (user is scrolling)
        let panGesture = scrollView.panGestureRecognizer
        let gestureState = panGesture.state
        
        print("[Aix] Checking interactive: keyboardDismissMode=\(scrollView.keyboardDismissMode.rawValue), panState=\(gestureState.rawValue)")
        
        // Pan gesture states: .began = 1, .changed = 2
        return gestureState == .began || gestureState == .changed
    }

    func calculateInterpolateContentOffsetY(isOpening: Bool, scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        if isOpening {
            return getContentOffsetYWhenOpening(scrollY: scrollY)
        } else {
            return calculateInterpolateContentOffsetYWhenClosing(scrollY: scrollY)
        }
    }

    private func isScrolledNearEnd() -> Bool {
        guard let scrollView = scrollView else { return false }
        let scrollY = scrollView.contentOffset.y
        print("[Aix] isScrolledNearEnd: scrollY=\(scrollY)")
        return false
    }
    
    func getContentOffsetYWhenOpening(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard let scrollView else { return nil } 
        let distFromEnd = scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom - scrollY
        let shouldShiftContentUp = blankSize == 0 && distFromEnd < (scrollEndReachedThreshold ?? 200)

        
        if shouldShiftContentUp {
            return (scrollY, scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom + keyboardHeightWhenOpen)    
        }
        return nil
    }
    func calculateInterpolateContentOffsetYWhenClosing(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        return nil
    }
    
    func keyboardManagerDidBecomeInteractive(_ manager: KeyboardManager) {
        print("[Aix] Keyboard became interactive!")
        
        // Update the existing startEvent to mark it as interactive
        if var event = startEvent {
            event.isInteractive = true
            startEvent = event
        }
    }
    
    func keyboardManagerDidEndAnimation(_ manager: KeyboardManager) {
        print("[Aix] Keyboard ended")
        
        startEvent = nil
        isInInteractiveDismiss = false
    }
}
