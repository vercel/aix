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
    var additionalContentInsets: AixAdditionalContentInsetsProp?
    
    func scrollToEnd(animated: Bool?) {
        // Dispatch to main thread since this may be called from RN background thread
        DispatchQueue.main.async { [weak self] in
            self?.scrollToEndInternal(animated: animated)
        }
    }
    
    func scrollToIndexWhenBlankSizeReady(index: Double, animated: Bool?, waitForKeyboardToEnd: Bool?) throws {
        queuedScrollToEnd = QueuedScrollToEnd(index: Int(index), animated: animated ?? true, waitForKeyboardToEnd: waitForKeyboardToEnd ?? false)
        DispatchQueue.main.async { [weak self] in
            self?.flushQueuedScrollToEnd()
            
        }
        
    }

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
    var scrollEndReachedThreshold: Double?

    var keyboardOpenBlankSizeThreshold: Double {
        return 0
    }

    // MARK: - Private Types
    
    struct QueuedScrollToEnd {
        var index: Int
        var animated: Bool
        var waitForKeyboardToEnd: Bool
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
    
    /// Clean up pan gesture observer to avoid retain cycles
    private func removePanGestureObserver() {
        guard didSetupPanGestureObserver, let scrollView = cachedScrollView else { return }
        scrollView.panGestureRecognizer.removeTarget(self, action: #selector(handlePanGesture(_:)))
        didSetupPanGestureObserver = false
    }
    
    deinit {
        removePanGestureObserver()
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
                startInteractiveKeyboardDismiss()
            }
            
        case .ended, .cancelled, .failed:
            if isInInteractiveDismiss {
                // The keyboard manager will handle the end via notifications
            }
            
        default:
            break
        }
    }
    
    /// Start tracking an interactive keyboard dismiss
    private func startInteractiveKeyboardDismiss() {
        return // this is totally broken rn, full of false positives
        guard !isInInteractiveDismiss else { return }
        isInInteractiveDismiss = true
        
        let scrollY = scrollView?.contentOffset.y ?? 0
        
        print("[Aix] Starting interactive keyboard dismiss from height=\(keyboardHeight), scrollY=\(scrollY)")
        
        // Calculate proper interpolation values (same as non-interactive close)
        let interpolation = getContentOffsetYWhenClosing(scrollY: scrollY)
        
        startEvent = KeyboardStartEvent(
            scrollY: scrollY,
            isOpening: false,
            isInteractive: true,
            interpolateContentOffsetY: interpolation, 
        )
    }
    
    /// Height of the composer view
    private var composerHeight: CGFloat {
        let h = composerView?.view.bounds.height ?? 0
        return max(0, h)
    }
    
    private var keyboardProgress: Double = 0

    private var additionalContentInsetBottom: CGFloat {
        if let additionalContentInsets {
            let interpolate = (additionalContentInsets.bottom.whenKeyboardClosed, additionalContentInsets.bottom.whenKeyboardOpen)
            
            return max(0, CGFloat(interpolate.0 + (interpolate.1 - interpolate.0) * keyboardProgress))
        }
        
        return 0
    }

    private func calculateBlankSize(keyboardHeight: CGFloat, additionalContentInsetBottom: CGFloat) -> CGFloat {
        guard let scrollView, let blankView else { return 0 }
        
        let cellBeforeBlankView = getCell(index: Int(blankView.index) - 1)
        let cellBeforeBlankViewHeight = cellBeforeBlankView?.view.frame.height ?? 0
        let blankViewHeight = blankView.view.frame.height
        
        // The inset is: scrollable area height - blank view height - keyboard height
        // This ensures when scrolled to end, the last message is at the top
        let inset = scrollView.bounds.height - blankViewHeight - cellBeforeBlankViewHeight - keyboardHeight - composerHeight + additionalContentInsetBottom
        return max(0, inset)
    }
    
    /// Calculate the blank size - the space needed to push content up
    /// so the last message can scroll to the top of the visible area
    var blankSize: CGFloat {
        return calculateBlankSize(keyboardHeight: keyboardHeight, additionalContentInsetBottom: additionalContentInsetBottom)
    }
    
    /// The content inset for the bottom of the scroll view
    
    private func calculateContentInsetBottom(keyboardHeight: CGFloat, blankSize: CGFloat, additionalContentInsetBottom: CGFloat) -> CGFloat {
        return blankSize + keyboardHeight + composerHeight + additionalContentInsetBottom
    }
    var contentInsetBottom: CGFloat {
        return calculateContentInsetBottom(keyboardHeight: self.keyboardHeight, blankSize: self.blankSize, additionalContentInsetBottom: self.additionalContentInsetBottom)
    }
    
    /// Apply the current content inset to the scroll view
    func applyContentInset(contentInsetBottom overrideContentInsetBottom: CGFloat? = nil) {
        guard let scrollView = scrollView else { return }
        if scrollView.contentInset.bottom != contentInsetBottom {
            scrollView.contentInset.bottom = overrideContentInsetBottom ?? self.contentInsetBottom
        }
    }
    
    
    private func scrollToEndInternal(animated: Bool?) {
        guard let scrollView = self.scrollView else { return }
        
        // Calculate the offset to show the bottom of content
        let bottomOffset = CGPoint(
            x: 0,
            y: max(0, scrollView.contentSize.height - scrollView.bounds.height + self.contentInsetBottom)
        )
        scrollView.setContentOffset(bottomOffset, animated: animated ?? true)
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
    
    // MARK: - AixContext Protocol

    private var lastReportedBlankViewSize = (size: CGSize.zero, index: 0)
    
    func reportBlankViewSizeChange(size: CGSize, index: Int) {
        let didAlreadyUpdate = size.height == lastReportedBlankViewSize.size.height && size.width == lastReportedBlankViewSize.size.width && index == lastReportedBlankViewSize.index
        if didAlreadyUpdate {
            return
        }

        lastReportedBlankViewSize = (size: size, index: index)
        
        // Update scroll view insets
        applyContentInset()
        
        // Check if we have a queued scroll waiting for this index
        if !didScrollToEndInitially {
            scrollToEndInternal(animated: false)
            didScrollToEndInitially = true
        } else if let queued = queuedScrollToEnd, index == queued.index {
            flushQueuedScrollToEnd()
        } 
    }
    
    func registerCell(_ cell: HybridAixCellView) {
        cells.setObject(cell, forKey: NSNumber(value: cell.index))
        
        // If this cell is marked as last, update our blank view reference
        if cell.isLast {
            blankView = cell
        }
    }
    
    func unregisterCell(_ cell: HybridAixCellView) {
        cells.removeObject(forKey: NSNumber(value: cell.index))
        
        // If this was our blank view, clear it
        if blankView === cell {
            blankView = nil
        }
    }
    
    func registerComposerView(_ composerView: HybridAixComposer) {
        self.composerView = composerView
    }
    
    func unregisterComposerView(_ composerView: HybridAixComposer) {
        if self.composerView === composerView {
            self.composerView = nil
        }
    }
    
    // MARK: - Cell Access
    
    /// Get a cell by its index
    func getCell(index: Int) -> HybridAixCellView? {
        return cells.object(forKey: NSNumber(value: index))
    }

    
    // MARK: - Scrolling

    func getIsQueuedScrollToEndReady(queuedScrollToEnd: QueuedScrollToEnd) -> Bool {
        guard let blankView else { return false }
        if queuedScrollToEnd.waitForKeyboardToEnd == true && startEvent != nil {
            return false
        }
        return blankView.isLast && queuedScrollToEnd.index == Int(blankView.index)
    }
    

    func flushQueuedScrollToEnd(force: Bool = false) {
        if let queuedScrollToEnd, (force || getIsQueuedScrollToEndReady(queuedScrollToEnd: queuedScrollToEnd)) {
            scrollToEndInternal(animated: queuedScrollToEnd.animated)
            self.queuedScrollToEnd = nil
        }
    }
}

// MARK: - KeyboardManagerDelegate

extension HybridAix: KeyboardManagerDelegate {
    func keyboardManager(_ manager: KeyboardManager, didUpdateHeight height: CGFloat, progress: CGFloat) {
        if keyboardHeightWhenOpen > 0 {
           keyboardProgress = height / keyboardHeightWhenOpen
        }
        print("keyboard progress: \(keyboardProgress), \(height) \(keyboardHeightWhenOpen)")
        keyboardHeight = height
        guard let startEvent else { return }

        applyContentInset()

        if let (startY, endY) = startEvent.interpolateContentOffsetY {
            let newScrollY = startY + (endY - startY) * progress
            scrollView?.setContentOffset(CGPoint(x: 0, y: newScrollY), animated: false)
        }
    }
    
    func keyboardManagerDidStartAnimation(_ manager: KeyboardManager, event: KeyboardManager.KeyboardEvent) {

        let isOpening = event.isOpening

        // Capture the target height when keyboard is opening - this is a snapshot, not reactive to each frame
        if isOpening, event.targetHeight > keyboardHeightWhenOpen {
            keyboardHeightWhenOpen = event.targetHeight
        }

        // If we're already in an interactive dismiss (detected via pan gesture),
        // don't overwrite the event
        if isInInteractiveDismiss {
            return
        }
        
        // Detect interactive dismissal by checking if:
        // 1. Keyboard is closing (not opening)
        // 2. Scroll view has interactive keyboard dismiss mode
        // 3. User is actively scrolling (pan gesture is in progress)
        var isInteractive = event.isInteractive || isInInteractiveDismiss
        
        if !isOpening && !isInteractive {
            isInteractive = isInteractiveDismissInProgress()
        }
        

        let scrollY = scrollView?.contentOffset.y ?? 0

        var interpolateContentOffsetY = {
            if event.isOpening {
                return self.getContentOffsetYWhenOpening(scrollY: scrollY)
            } else {
                return self.getContentOffsetYWhenClosing(scrollY: scrollY)
            }
        }()
        
        if queuedScrollToEnd != nil {
            // don't interpolate the keyboard if we're planning to scroll to end
            interpolateContentOffsetY = nil
        }

        print("[Aix] keyboardManagerDidStartAnimation: interpolateContentOffsetY=\(String(describing: interpolateContentOffsetY))")
        print("[Aix] keyboardManagerDidStartAnimation: queuedScrollToEnd=\(queuedScrollToEnd != nil)")

        startEvent = KeyboardStartEvent(
            scrollY: scrollY,
            isOpening: event.isOpening,
            isInteractive: isInteractive,
            interpolateContentOffsetY: interpolateContentOffsetY,
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
        
        
        // Pan gesture states: .began = 1, .changed = 2
        return gestureState == .began || gestureState == .changed
    }

    var distFromEnd: CGFloat {
        guard let scrollView = scrollView else { return 0 }
        return scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom - scrollView.contentOffset.y - composerHeight - additionalContentInsetBottom
    }
    func getIsScrolledNearEnd(distFromEnd: CGFloat) -> Bool {
        return distFromEnd <= (scrollEndReachedThreshold ?? max(200, blankSize))
    }
    
    func getContentOffsetYWhenOpening(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard let scrollView else { return nil } 
        let isScrolledNearEnd = getIsScrolledNearEnd(distFromEnd: distFromEnd)
        let shouldShiftContentUp = blankSize == 0 && isScrolledNearEnd
        
        let additionalContentInsetBottom = CGFloat(self.additionalContentInsets?.bottom.whenKeyboardOpen ?? 0)

        let shiftContentUpToY = scrollView.contentSize.height - scrollView.bounds.height + keyboardHeightWhenOpen + composerHeight - additionalContentInsetBottom
        
        if shouldShiftContentUp {
            return (scrollY, shiftContentUpToY)    
        }

        let hasBlankSizeLessThanOpenKeyboardHeight = blankSize > 0 && blankSize <= keyboardHeightWhenOpen

        if hasBlankSizeLessThanOpenKeyboardHeight && isScrolledNearEnd {
            return (scrollY, shiftContentUpToY)    
        }


        return nil
    }
    func getContentOffsetYWhenClosing(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard keyboardHeightWhenOpen > 0 else { return nil }
        let isScrolledNearEnd = getIsScrolledNearEnd(distFromEnd: distFromEnd)

        if !isScrolledNearEnd {
            return nil
        }

        let additionalContentInsetBottomWithKeyboard = CGFloat(self.additionalContentInsets?.bottom.whenKeyboardOpen ?? 0)
        let additionalContentInsetBottomWithoutKeyboard = CGFloat(self.additionalContentInsets?.bottom.whenKeyboardClosed ?? 0)
        
        // Calculate how much content inset will decrease when keyboard closes
        let blankSizeWithKeyboard = calculateBlankSize(keyboardHeight: keyboardHeightWhenOpen, additionalContentInsetBottom: additionalContentInsetBottomWithKeyboard)
        let blankSizeWithoutKeyboard = calculateBlankSize(keyboardHeight: 0, additionalContentInsetBottom: additionalContentInsetBottomWithoutKeyboard)
        
        // Calculate actual content insets (including composer)
        let insetWithKeyboard = calculateContentInsetBottom(keyboardHeight: keyboardHeightWhenOpen, blankSize: blankSizeWithKeyboard, additionalContentInsetBottom: additionalContentInsetBottomWithKeyboard)
        let insetWithoutKeyboard = calculateContentInsetBottom(keyboardHeight: 0, blankSize: blankSizeWithoutKeyboard,
           additionalContentInsetBottom: additionalContentInsetBottomWithoutKeyboard
        )
        let insetDecrease = insetWithKeyboard - insetWithoutKeyboard
        
        // To keep the visual content position stable, we need to decrease scrollY 
        // by the same amount the inset decreases
        let targetScrollY = max(0, scrollY - insetDecrease)
        
        
        // Only interpolate if there's actually movement needed
        guard abs(scrollY - targetScrollY) > 1 else { return nil }
        
        return (scrollY, targetScrollY)
    }
    
    func keyboardManagerDidBecomeInteractive(_ manager: KeyboardManager) {
        
        // Update the existing startEvent to mark it as interactive
        if var event = startEvent {
            event.isInteractive = true
            startEvent = event
        }
    }
    
    func keyboardManagerDidEndAnimation(_ manager: KeyboardManager) {

        startEvent = nil
        isInInteractiveDismiss = false

        if queuedScrollToEnd?.waitForKeyboardToEnd == true {
            flushQueuedScrollToEnd(force: true)
        }
        
    }
}
