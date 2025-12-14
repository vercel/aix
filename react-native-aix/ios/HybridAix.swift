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
    var scrollEndReachedThreshold: Double?

    var keyboardOpenBlankSizeThreshold: Double {
        return 0
    }

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
        print("[Aix] composerHeight: \(h)")
        return max(0, h)
    }

    private func calculateBlankSize(keyboardHeight: CGFloat) -> CGFloat {
        guard let scrollView, let blankView else { return 0 }
        
        let cellBeforeBlankView = getCell(index: Int(blankView.index) - 1)
        let cellBeforeBlankViewHeight = cellBeforeBlankView?.view.frame.height ?? 0
        let blankViewHeight = blankView.view.frame.height
        
        // The inset is: scrollable area height - blank view height - keyboard height
        // This ensures when scrolled to end, the last message is at the top
        let inset = scrollView.bounds.height - blankViewHeight - cellBeforeBlankViewHeight - keyboardHeight - composerHeight
        return max(0, inset)
    }
    
    /// Calculate the blank size - the space needed to push content up
    /// so the last message can scroll to the top of the visible area
    var blankSize: CGFloat {
        return calculateBlankSize(keyboardHeight: keyboardHeight)
    }
    
    /// The content inset for the bottom of the scroll view
    
    private func calculateContentInsetBottom(keyboardHeight: CGFloat, blankSize: CGFloat) -> CGFloat {
        return blankSize + keyboardHeight + composerHeight
    }
    var contentInsetBottom: CGFloat {
        return calculateContentInsetBottom(keyboardHeight: self.keyboardHeight, blankSize: self.blankSize)
    }
    
    /// Apply the current content inset to the scroll view
    func applyContentInset(contentInsetBottom overrideContentInsetBottom: CGFloat? = nil) {
        guard let scrollView = scrollView else { return }
        if scrollView.contentInset.bottom != contentInsetBottom {
            let scrollYBefore = scrollView.contentOffset.y
            let oldInset = scrollView.contentInset.bottom
            
            scrollView.contentInset.bottom = overrideContentInsetBottom ?? self.contentInsetBottom
            
            let scrollYAfter = scrollView.contentOffset.y
            
            // Only log when UIKit auto-adjusted the scroll position (the bug we're hunting)
            if scrollYBefore != scrollYAfter {
                let maxScrollYBefore = scrollView.contentSize.height - scrollView.bounds.height + oldInset
                let maxScrollYAfter = scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom
                print("[Aix] ⚠️ SCROLL JUMP DETECTED")
                print("[Aix]    inset: \(oldInset) -> \(contentInsetBottom) (delta: \(contentInsetBottom - oldInset))")
                print("[Aix]    scrollY: \(scrollYBefore) -> \(scrollYAfter) (delta: \(scrollYAfter - scrollYBefore))")
                print("[Aix]    maxScrollY: \(maxScrollYBefore) -> \(maxScrollYAfter)")
                print("[Aix]    exceeded max? \(scrollYBefore > maxScrollYAfter)")
            }
        }
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
        keyboardHeight = height
        guard let startEvent else { 
            print("[Aix][didUpdateHeight] NO startEvent, returning early")
            return 
        }
        
        let isClosing = !startEvent.isOpening
        let hasInterpolation = startEvent.interpolateContentOffsetY != nil
        
        print("[Aix][didUpdateHeight] isClosing=\(isClosing), hasInterpolation=\(hasInterpolation), progress=\(progress)")
        
        // When closing with interpolation, skip applyContentInset to prevent UIKit from 
        // clamping the scroll position. We'll apply the final inset in keyboardManagerDidEndAnimation.
        if !(isClosing && hasInterpolation) {
            applyContentInset()
        } else {
            print("[Aix][didUpdateHeight] SKIPPING applyContentInset during close")
        }

        if let (startY, endY) = startEvent.interpolateContentOffsetY {
            let newScrollY = startY + (endY - startY) * progress
            print("[Aix][didUpdateHeight] INTERPOLATING: startY=\(startY), endY=\(endY), progress=\(progress) -> newScrollY=\(newScrollY)")
            scrollView?.setContentOffset(CGPoint(x: 0, y: newScrollY), animated: false)
        } else {
            print("[Aix][didUpdateHeight] NO interpolation values")
        }
    }
    
    func keyboardManagerDidStartAnimation(_ manager: KeyboardManager, event: KeyboardManager.KeyboardEvent) {
        print("[Aix][keyboardManagerDidStartAnimation] \(String(describing: event))")

        let isOpening = event.isOpening

        // Capture the target height when keyboard is opening - this is a snapshot, not reactive to each frame
        if isOpening, event.targetHeight > 0 {
            keyboardHeightWhenOpen = event.targetHeight
            print("[Aix] Set keyboardHeightWhenOpen=\(keyboardHeightWhenOpen)")
        }

        // If we're already in an interactive dismiss (detected via pan gesture),
        // don't overwrite the event - just log and return
        if isInInteractiveDismiss {
            print("[Aix] Keyboard notification received during interactive dismiss - keeping existing event")
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
        
        print("[Aix] Keyboard started: isInteractive=\(isInteractive)")

        let scrollY = scrollView?.contentOffset.y ?? 0

        let interpolateContentOffsetY = {
            if event.isOpening {
                return self.getContentOffsetYWhenOpening(scrollY: scrollY)
            } else {
                return self.getContentOffsetYWhenClosing(scrollY: scrollY)
            }
        }()

        startEvent = KeyboardStartEvent(
            scrollY: scrollY,
            isOpening: event.isOpening,
            isInteractive: isInteractive,
            interpolateContentOffsetY: interpolateContentOffsetY,
        )
        
        print("[Aix][keyboardManagerDidStartAnimation] startEvent: \(String(describing: startEvent))")
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

    var distFromEnd: CGFloat {
        guard let scrollView = scrollView else { return 0 }
        return scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom - scrollView.contentOffset.y - composerHeight
    }
    func getIsScrolledNearEnd(distFromEnd: CGFloat) -> Bool {
        return distFromEnd <= (scrollEndReachedThreshold ?? max(200, blankSize))
    }
    
    func getContentOffsetYWhenOpening(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard let scrollView else { return nil } 
        let isScrolledNearEnd = getIsScrolledNearEnd(distFromEnd: distFromEnd)
        print("[Aix][getContentOffsetYWhenOpening][isScrolledNearEnd] \(isScrolledNearEnd), distFromEnd=\(distFromEnd) blankSize=\(blankSize)")
        let shouldShiftContentUp = blankSize == 0 && isScrolledNearEnd
        
        if shouldShiftContentUp {
            return (scrollY, scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom + keyboardHeightWhenOpen + composerHeight)    
        }

        let blankSizeWhenKeyboardIsOpen = calculateBlankSize(keyboardHeight: keyboardHeightWhenOpen)
        print("[getContentOffsetYWhenOpening] \(blankSize), \(blankSizeWhenKeyboardIsOpen) \(keyboardHeightWhenOpen) \(contentInsetBottom)")
        // if blankSize > 0, blankSizeWhenKeyboardIsOpen <= keyboardOpenBlankSizeThreshold {
        //     return (scrollY, scrollView.contentSize.height - scrollView.bounds.height + keyboardHeightWhenOpen)    
        // }
        if blankSize > 0, blankSize <= keyboardHeightWhenOpen, isScrolledNearEnd {
            return (scrollY, scrollView.contentSize.height - scrollView.bounds.height + keyboardHeightWhenOpen + composerHeight)    
        }


        return nil
    }
    func getContentOffsetYWhenClosing(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard let scrollView = scrollView else { return nil }
        guard keyboardHeightWhenOpen > 0 else { return nil }
        let isScrolledNearEnd = getIsScrolledNearEnd(distFromEnd: distFromEnd)

        if !isScrolledNearEnd {
            print("[Aix] getContentOffsetYWhenClosing: not scrolled near end, returning nil")
            return nil
        }

        print("[Aix][getContentOffsetYWhenClosing][distFromEnd] \(distFromEnd)")
        
        // Calculate how much content inset will decrease when keyboard closes
        let blankSizeWithKeyboard = calculateBlankSize(keyboardHeight: keyboardHeightWhenOpen)
        let blankSizeWithoutKeyboard = calculateBlankSize(keyboardHeight: 0)
        
        // Calculate actual content insets (including composer)
        let insetWithKeyboard = calculateContentInsetBottom(keyboardHeight: keyboardHeightWhenOpen, blankSize: blankSizeWithKeyboard)
        let insetWithoutKeyboard = calculateContentInsetBottom(keyboardHeight: 0, blankSize: blankSizeWithoutKeyboard)
        let insetDecrease = insetWithKeyboard - insetWithoutKeyboard
        
        // To keep the visual content position stable, we need to decrease scrollY 
        // by the same amount the inset decreases
        let targetScrollY = max(0, scrollY - insetDecrease)
        
        print("[Aix] getContentOffsetYWhenClosing:")
        print("[Aix]   keyboardHeightWhenOpen=\(keyboardHeightWhenOpen), composerHeight=\(composerHeight)")
        print("[Aix]   blankSizeWithKeyboard=\(blankSizeWithKeyboard), blankSizeWithoutKeyboard=\(blankSizeWithoutKeyboard)")
        print("[Aix]   insetWithKeyboard=\(insetWithKeyboard), insetWithoutKeyboard=\(insetWithoutKeyboard)")
        print("[Aix]   insetDecrease=\(insetDecrease)")
        print("[Aix]   scrollY=\(scrollY) -> targetScrollY=\(targetScrollY)")
        
        // Only interpolate if there's actually movement needed
        guard abs(scrollY - targetScrollY) > 1 else { return nil }
        
        return (scrollY, targetScrollY)
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
