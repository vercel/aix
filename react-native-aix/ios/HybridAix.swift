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

    /// Called when the composer's height changes
    func reportComposerHeightChange(height: CGFloat)
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

    /// Recursively search subviews to find a UIScrollView by accessibilityIdentifier (nativeID)
    func findScrollView(withIdentifier identifier: String) -> UIScrollView? {
        if let scrollView = self as? UIScrollView, scrollView.accessibilityIdentifier == identifier {
            return scrollView
        }
        for subview in subviews {
            if let scrollView = subview.findScrollView(withIdentifier: identifier) {
                return scrollView
            }
        }
        return nil
    }

    /// Recursively search subviews to find the first UIScrollView
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

class HybridAix: HybridAixSpec, AixContext, KeyboardNotificationsDelegate {

    var penultimateCellIndex: Double?

    var additionalContentInsets: AixAdditionalContentInsetsProp?

    var additionalScrollIndicatorInsets: AixScrollIndicatorInsets? {
        didSet {
            guard cachedScrollView != nil else { return }
            applyScrollIndicatorInsets()
        }
    }

    var scrollOnComposerSizeUpdate: AixScrollOnFooterSizeUpdate?

    var mainScrollViewID: String?
    
    func scrollToEnd(animated: Bool?) {
        // Dispatch to main thread since this may be called from RN background thread
        DispatchQueue.main.async { [weak self] in
            self?.scrollToEndInternal(animated: animated)
        }
    }
    
    func scrollToIndexWhenBlankSizeReady(index: Double, animated: Bool?, waitForKeyboardToEnd: Bool?) throws {
        queuedScrollToEnd = QueuedScrollToEnd(index: Int(index), animated: animated ?? true, waitForKeyboardToEnd: waitForKeyboardToEnd ?? false)
        
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            
            // Clear any in-progress keyboard scroll interpolation since we're taking over scrolling
            if let event = self.startEvent {
                self.startEvent = KeyboardStartEvent(
                    scrollY: event.scrollY,
                    isOpening: event.isOpening,
                    isInteractive: event.isInteractive,
                    interpolateContentOffsetY: nil
                )
            }
            
            self.flushQueuedScrollToEnd()
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

    /// Tracks whether the app is in the background (to disable keyboard notifications)
    private var isAppInBackground = false
    
    // MARK: - Props (from Nitro spec)
    var shouldStartAtEnd: Bool = true
    var scrollOnFooterSizeUpdate: AixScrollOnFooterSizeUpdate?
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
    /// If mainScrollViewID is provided, searches by accessibilityIdentifier first
    var scrollView: UIScrollView? {
        if let cached = cachedScrollView {
            return cached
        }
        let searchRoot = view.superview ?? view

        // If mainScrollViewID is provided, try to find by accessibilityIdentifier first
        var sv: UIScrollView? = nil
        if let scrollViewID = mainScrollViewID, !scrollViewID.isEmpty {
            sv = searchRoot.findScrollView(withIdentifier: scrollViewID)
            if sv != nil {
                print("[Aix] scrollView found by ID '\(scrollViewID)': \(String(describing: sv))")
            }
        }

        // Fallback to default subview iteration if not found by ID
        if sv == nil {
            sv = searchRoot.findScrollView()
            print("[Aix] scrollView found by iteration: \(String(describing: sv))")
        }

        cachedScrollView = sv

        // Set up pan gesture observer when we find the scroll view
        if let scrollView = sv, !didSetupPanGestureObserver {
            // Disable automatic scroll indicator inset adjustment so we can control it manually
            scrollView.automaticallyAdjustsScrollIndicatorInsets = false

            setupPanGestureObserver()
            applyScrollIndicatorInsets()
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
    
    /// Handle pan gesture state changes to detect interactive keyboard dismiss
    @objc private func handlePanGesture(_ gesture: UIPanGestureRecognizer) {
        guard let scrollView = cachedScrollView,
              scrollView.keyboardDismissMode == .interactive,
              keyboardHeight > 0 else { return }

        switch gesture.state {
        case .began, .changed:
            // Check if finger has reached the top of composer (or keyboard if no composer)
            if !isInInteractiveDismiss && isFingerAtComposerTop(gesture: gesture) {
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

    /// Check if the finger position has reached the top of the composer view
    private func isFingerAtComposerTop(gesture: UIPanGestureRecognizer) -> Bool {
        guard let window = view.window else { return false }

        // Get finger location in window coordinates
        let fingerLocationInWindow = gesture.location(in: window)

        // Get the threshold Y position (top of composer, or top of keyboard if no composer)
        let thresholdY: CGFloat
        if let composerView = composerView?.view, let composerWindow = composerView.window {
            // Convert composer's frame to window coordinates
            let composerFrameInWindow = composerView.convert(composerView.bounds, to: composerWindow)
            thresholdY = composerFrameInWindow.minY
        } else {
            // Fallback: use keyboard top position
            let screenHeight = UIScreen.main.bounds.height
            thresholdY = screenHeight - keyboardHeight
        }

        // Finger has reached the composer top when its Y >= threshold
        return fingerLocationInWindow.y >= thresholdY
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

    private var additionalContentInsetTop: CGFloat {
        if let additionalContentInsets, let top = additionalContentInsets.top {
            let interpolate = (top.whenKeyboardClosed, top.whenKeyboardOpen)
            return CGFloat(interpolate.0 + (interpolate.1 - interpolate.0) * keyboardProgress)
        }
        return 0
    }

    private var additionalContentInsetBottom: CGFloat {
        if let additionalContentInsets, let bottom = additionalContentInsets.bottom {
            let interpolate = (bottom.whenKeyboardClosed, bottom.whenKeyboardOpen)
            return max(0, CGFloat(interpolate.0 + (interpolate.1 - interpolate.0) * keyboardProgress))
        }
        return 0
    }

    private func calculateBlankSize(keyboardHeight: CGFloat, additionalContentInsetBottom: CGFloat) -> CGFloat {
        guard let scrollView, let blankView else { return 0 }
        
        let cellBeforeBlankView = getCell(index: Int(blankView.index) - 1)
        let cellBeforeBlankViewHeight = cellBeforeBlankView?.view.frame.height ?? 0
        let blankViewHeight = blankView.view.frame.height
        
        // Calculate visible area above all bottom chrome (keyboard, composer, additional insets)
        // The blank size fills the remaining space so the last message can scroll to the top
        let visibleAreaHeight = scrollView.bounds.height - keyboardHeight - composerHeight - additionalContentInsetBottom
        let inset = visibleAreaHeight - blankViewHeight - cellBeforeBlankViewHeight
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
        guard let scrollView else { return }

        let targetTop = additionalContentInsetTop
        if scrollView.contentInset.top != targetTop {
            scrollView.contentInset.top = targetTop
        }

        let targetBottom = overrideContentInsetBottom ?? self.contentInsetBottom
        if scrollView.contentInset.bottom != targetBottom {
            scrollView.contentInset.bottom = targetBottom
        }
    }

    /// Apply scroll indicator insets to the scroll view
    /// Includes keyboard height, composer height, and additional insets from props
    func applyScrollIndicatorInsets() {
        guard let scrollView else { return }

        // Calculate additional top inset based on keyboard progress
        var additionalTop: CGFloat = 0
        if let insets = additionalScrollIndicatorInsets, let top = insets.top {
            additionalTop = CGFloat(top.whenKeyboardClosed + (top.whenKeyboardOpen - top.whenKeyboardClosed) * keyboardProgress)
        }

        // Calculate additional bottom inset based on keyboard progress
        var additionalBottom: CGFloat = 0
        if let insets = additionalScrollIndicatorInsets, let bottom = insets.bottom {
            additionalBottom = CGFloat(bottom.whenKeyboardClosed + (bottom.whenKeyboardOpen - bottom.whenKeyboardClosed) * keyboardProgress)
        }

        // Bottom inset: keyboard + composer + additional
        // Note: Don't add safe area here - the footer handles its own safe area padding internally
        let bottomInset = keyboardHeight + composerHeight + additionalBottom

        let newInsets = UIEdgeInsets(
            top: additionalTop,
            left: 0,
            bottom: bottomInset,
            right: 0
        )

        if scrollView.verticalScrollIndicatorInsets != newInsets {
            scrollView.verticalScrollIndicatorInsets = newInsets
        }
    }

    private func scrollToEndInternal(animated: Bool?) {
        guard let scrollView else { return }
        
        // Calculate the offset to show the bottom of content
        let bottomOffset = CGPoint(
            x: 0,
            y: max(0, scrollView.contentSize.height - scrollView.bounds.height + self.contentInsetBottom)
        )
        scrollView.setContentOffset(bottomOffset, animated: animated ?? true)
    }

    
    // MARK: - Keyboard Observer (notification-based)

    private lazy var keyboardNotifications: KeyboardNotifications = {
        return KeyboardNotifications(notifications: [.willShow, .willHide, .didShow, .didHide, .willChangeFrame], delegate: self)
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
    
    /// Handle keyboard will move (start of animation)
    private func handleKeyboardWillMove(targetHeight: CGFloat, isOpening: Bool) {
        // Capture the target height when keyboard is opening
        if isOpening && targetHeight > keyboardHeightWhenOpen {
            keyboardHeightWhenOpen = targetHeight
        }
        
        // If we're already in an interactive dismiss, don't overwrite
        if isInInteractiveDismiss {
            return
        }
        
        let scrollY = scrollView?.contentOffset.y ?? 0
        
        var interpolateContentOffsetY: (CGFloat, CGFloat)? = {
            if isOpening {
                return self.getContentOffsetYWhenOpening(scrollY: scrollY)
            } else {
                return self.getContentOffsetYWhenClosing(scrollY: scrollY)
            }
        }()
        
        if queuedScrollToEnd != nil {
            // don't interpolate the keyboard if we're planning to scroll to end
            interpolateContentOffsetY = nil
        }
        
        print("[Aix] handleKeyboardWillMove: isOpening=\(isOpening), interpolate=\(String(describing: interpolateContentOffsetY))")
        
        startEvent = KeyboardStartEvent(
            scrollY: scrollY,
            isOpening: isOpening,
            isInteractive: false,
            interpolateContentOffsetY: interpolateContentOffsetY
        )
    }
    
    /// Handle keyboard frame updates during animation
    private func handleKeyboardMove(height: CGFloat, progress: CGFloat) {
        if keyboardHeightWhenOpen > 0 {
            keyboardProgress = height / keyboardHeightWhenOpen
        }
        keyboardHeight = height
        
        guard let startEvent else { return }

        applyContentInset()
        applyScrollIndicatorInsets()

        if let (startY, endY) = startEvent.interpolateContentOffsetY {
            // Normalize progress to always go from 0 to 1 (start to end)
            // For opening: progress goes 0→1, so use as-is
            // For closing: progress goes 1→0, so invert it
            let normalizedProgress = startEvent.isOpening ? progress : (1 - progress)
            let newScrollY = startY + (endY - startY) * normalizedProgress
            scrollView?.setContentOffset(CGPoint(x: 0, y: newScrollY), animated: false)
        }
    }
    
    /// Handle keyboard animation end
    private func handleKeyboardDidMove(height: CGFloat, progress: CGFloat) {
        // Ensure final height is applied
        keyboardHeight = height
        if keyboardHeightWhenOpen > 0 {
            keyboardProgress = height / keyboardHeightWhenOpen
        }

        applyContentInset()
        applyScrollIndicatorInsets()

        startEvent = nil
        isInInteractiveDismiss = false
        
        if queuedScrollToEnd?.waitForKeyboardToEnd == true {
            flushQueuedScrollToEnd(force: true)
        }
    }
    
    /// Handle interactive keyboard dismissal
    private func handleKeyboardMoveInteractive(height: CGFloat, progress: CGFloat) {
        // Mark that we're in an interactive dismiss if not already
        if !isInInteractiveDismiss && startEvent != nil {
            isInInteractiveDismiss = true
            if var event = startEvent {
                event.isInteractive = true
                startEvent = event
            }
        }
        
        // Update keyboard state
        handleKeyboardMove(height: height, progress: progress)
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
    
    deinit {
        removePanGestureObserver()
    }
    
    // MARK: - Lifecycle

    /// Called when our view is added to or removed from the HybridAixComponent
    private func handleDidMoveToSuperview() {
        if let superview = view.superview {
            print("[Aix] View added to superview: \(type(of: superview)), attaching context")
            // Attach context to the superview (HybridAixComponent) so children can find it
            superview.aixContext = self

            // Enable keyboard notifications (unless app is in background)
            if !isAppInBackground {
                keyboardNotifications.isEnabled = true
            }

            // Add app lifecycle observers
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleAppDidEnterBackground),
                name: UIApplication.didEnterBackgroundNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleAppWillEnterForeground),
                name: UIApplication.willEnterForegroundNotification,
                object: nil
            )
        } else {
            // View removed from superview - disable keyboard notifications
            keyboardNotifications.isEnabled = false

            // Remove app lifecycle observers
            NotificationCenter.default.removeObserver(self, name: UIApplication.didEnterBackgroundNotification, object: nil)
            NotificationCenter.default.removeObserver(self, name: UIApplication.willEnterForegroundNotification, object: nil)
        }
    }

    @objc private func handleAppDidEnterBackground() {
        isAppInBackground = true
        keyboardNotifications.isEnabled = false
    }

    @objc private func handleAppWillEnterForeground() {
        isAppInBackground = false
        // Only re-enable if view is still in a superview
        if view.superview != nil {
            keyboardNotifications.isEnabled = true
        }
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
        applyScrollIndicatorInsets()

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

    private var lastReportedComposerHeight: CGFloat = 0

    func reportComposerHeightChange(height: CGFloat) {
        if height == lastReportedComposerHeight {
            return
        }

        let previousHeight = lastReportedComposerHeight
        let isShrinking = height < previousHeight

        let shouldScroll = shouldScrollOnFooterSizeUpdate()
        let animated = scrollOnFooterSizeUpdate?.animated ?? false

        lastReportedComposerHeight = height

        if shouldScroll && animated && isShrinking {
            guard let scrollView else {
                applyContentInset()
                applyScrollIndicatorInsets()
                return
            }

            let newContentInsetBottom = self.contentInsetBottom
            let bottomOffset = CGPoint(
                x: 0,
                y: max(0, scrollView.contentSize.height - scrollView.bounds.height + newContentInsetBottom)
            )

            UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseOut]) {
                scrollView.contentInset.bottom = newContentInsetBottom
                scrollView.contentOffset = bottomOffset
            }
            applyScrollIndicatorInsets()
        } else {
            applyContentInset()
            applyScrollIndicatorInsets()

            if shouldScroll {
                scrollToEndInternal(animated: animated)
            }
        }
    }

    private func shouldScrollOnFooterSizeUpdate() -> Bool {
        guard let settings = scrollOnFooterSizeUpdate, settings.enabled else {
            return false
        }
        guard let scrollView else {
            return false
        }

        let contentHeight = scrollView.contentSize.height
        let scrollViewHeight = scrollView.bounds.height
        let currentOffsetY = scrollView.contentOffset.y
        let bottomInset = scrollView.contentInset.bottom

        let maxOffsetY = max(0, contentHeight - scrollViewHeight + bottomInset)
        let distanceFromEnd = maxOffsetY - currentOffsetY

        let threshold = settings.scrolledToEndThreshold ?? 0
        return distanceFromEnd <= CGFloat(threshold)
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
    
    // MARK: - Keyboard Notification Handlers

    func keyboardWillShow(notification: NSNotification) {
        guard let userInfo = notification.userInfo,
              let keyboardFrame = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect,
              let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double,
              let curveValue = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt else { return }

        let targetHeight = keyboardFrame.height
        print("[Aix] keyboardWillShow: targetHeight=\(targetHeight), duration=\(duration)")

        guard duration > 0 else { return }

        if targetHeight > keyboardHeightWhenOpen {
            keyboardHeightWhenOpen = targetHeight
        }

        handleKeyboardWillMove(targetHeight: targetHeight, isOpening: true)

        let options = UIView.AnimationOptions(rawValue: curveValue << 16)
        UIView.animate(withDuration: duration, delay: 0, options: options, animations: { [weak self] in
            guard let self = self else { return }
            self.keyboardHeight = targetHeight
            if self.keyboardHeightWhenOpen > 0 {
                self.keyboardProgress = targetHeight / self.keyboardHeightWhenOpen
            }
            self.applyContentInset()
            self.applyScrollIndicatorInsets()

            if let (startY, endY) = self.startEvent?.interpolateContentOffsetY {
                self.scrollView?.setContentOffset(CGPoint(x: 0, y: endY), animated: false)
            }
        }, completion: { [weak self] _ in
            self?.handleKeyboardDidMove(height: targetHeight, progress: 1.0)
        })
    }

    func keyboardWillHide(notification: NSNotification) {
        guard let userInfo = notification.userInfo,
              let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double,
              let curveValue = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt else { return }

        print("[Aix] keyboardWillHide: duration=\(duration)")

        // Don't interpolate scroll position when closing, the inset change will handle the visual transition
        startEvent = nil

        let options = UIView.AnimationOptions(rawValue: curveValue << 16)
        UIView.animate(withDuration: duration, delay: 0, options: options, animations: { [weak self] in
            guard let self = self else { return }

            self.keyboardHeight = 0
            self.keyboardProgress = 0
            self.applyContentInset()
            self.applyScrollIndicatorInsets()
        }, completion: { [weak self] _ in
            self?.handleKeyboardDidMove(height: 0, progress: 0)
        })
    }

    func keyboardDidShow(notification: NSNotification) {
        print("[Aix] keyboardDidShow")
    }

    func keyboardDidHide(notification: NSNotification) {
        print("[Aix] keyboardDidHide")
        keyboardHeightWhenOpen = 0
    }

    func keyboardWillChangeFrame(notification: NSNotification) {
        guard let userInfo = notification.userInfo,
              let keyboardFrameEnd = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }

        let screenHeight = UIScreen.main.bounds.height
        let keyboardTop = keyboardFrameEnd.origin.y
        let newHeight = max(0, screenHeight - keyboardTop)

        if startEvent != nil && !isInInteractiveDismiss {
            return
        }

        if isInInteractiveDismiss && newHeight != keyboardHeight {
            let progress = keyboardHeightWhenOpen > 0 ? newHeight / keyboardHeightWhenOpen : 0
            handleKeyboardMoveInteractive(height: newHeight, progress: progress)
        }
    }
}

// MARK: - Scroll Position Helpers

extension HybridAix {
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

    /// Distance from current scroll position to the maximum scroll position (end)
    var distFromEnd: CGFloat {
        guard let scrollView = scrollView else { return 0 }
        let maxScrollY = scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom
        return maxScrollY - scrollView.contentOffset.y
    }
    
    func getIsScrolledNearEnd(distFromEnd: CGFloat) -> Bool {
        return distFromEnd <= (scrollEndReachedThreshold ?? max(200, blankSize))
    }
    
    func getContentOffsetYWhenOpening(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard let scrollView else { return nil } 
        let isScrolledNearEnd = getIsScrolledNearEnd(distFromEnd: distFromEnd)
        let shouldShiftContentUp = blankSize == 0 && isScrolledNearEnd
        
        // Use the target additionalContentInsetBottom when keyboard is fully open
        let targetAdditionalInset = CGFloat(self.additionalContentInsets?.bottom?.whenKeyboardOpen ?? 0)
        
        // Calculate the max scroll position when keyboard is open
        // This is where we want to scroll to: contentSize - bounds + contentInset
        // When blankSize is 0: contentInset = keyboard + composer + additionalInset
        let shiftContentUpToY = scrollView.contentSize.height - scrollView.bounds.height + keyboardHeightWhenOpen + composerHeight + targetAdditionalInset
        
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

        let additionalContentInsetBottomWithKeyboard = CGFloat(self.additionalContentInsets?.bottom?.whenKeyboardOpen ?? 0)
        let additionalContentInsetBottomWithoutKeyboard = CGFloat(self.additionalContentInsets?.bottom?.whenKeyboardClosed ?? 0)
        
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
}

// Source - https://stackoverflow.com/a
// Posted by Vasily  Bodnarchuk, modified by community. See post 'Timeline' for change history
// Retrieved 2026-01-07, License - CC BY-SA 4.0

protocol KeyboardNotificationsDelegate: AnyObject {
    func keyboardWillShow(notification: NSNotification)
    func keyboardWillHide(notification: NSNotification)
    func keyboardDidShow(notification: NSNotification)
    func keyboardDidHide(notification: NSNotification)
    func keyboardWillChangeFrame(notification: NSNotification)
}

extension KeyboardNotificationsDelegate {
    func keyboardWillShow(notification: NSNotification) {}
    func keyboardWillHide(notification: NSNotification) {}
    func keyboardDidShow(notification: NSNotification) {}
    func keyboardDidHide(notification: NSNotification) {}
    func keyboardWillChangeFrame(notification: NSNotification) {}
}

class KeyboardNotifications {
    fileprivate var _isEnabled: Bool
    fileprivate var notifications: [KeyboardNotificationsType]
    fileprivate weak var delegate: KeyboardNotificationsDelegate?

    init(notifications: [KeyboardNotificationsType], delegate: KeyboardNotificationsDelegate) {
        _isEnabled = false
        self.notifications = notifications
        self.delegate = delegate
    }

    deinit { if isEnabled { isEnabled = false } }
}

// MARK: - enums

extension KeyboardNotifications {

    enum KeyboardNotificationsType {
        case willShow, willHide, didShow, didHide, willChangeFrame

        var selector: Selector {
            switch self {
                case .willShow: return #selector(keyboardWillShow(notification:))
                case .willHide: return #selector(keyboardWillHide(notification:))
                case .didShow: return #selector(keyboardDidShow(notification:))
                case .didHide: return #selector(keyboardDidHide(notification:))
                case .willChangeFrame: return #selector(keyboardWillChangeFrame(notification:))
            }
        }

        var notificationName: NSNotification.Name {
            switch self {
                case .willShow: return UIResponder.keyboardWillShowNotification
                case .willHide: return UIResponder.keyboardWillHideNotification
                case .didShow: return UIResponder.keyboardDidShowNotification
                case .didHide: return UIResponder.keyboardDidHideNotification
                case .willChangeFrame: return UIResponder.keyboardWillChangeFrameNotification
            }
        }
    }
}

// MARK: - isEnabled

extension KeyboardNotifications {

    private func addObserver(type: KeyboardNotificationsType) {
        NotificationCenter.default.addObserver(self, selector: type.selector, name: type.notificationName, object: nil)
    }

    var isEnabled: Bool {
        set {
            if newValue {
                for notificaton in notifications { addObserver(type: notificaton) }
            } else {
                NotificationCenter.default.removeObserver(self)
            }
            _isEnabled = newValue
        }

        get { return _isEnabled }
    }

}

// MARK: - Notification functions

extension KeyboardNotifications {

    @objc func keyboardWillShow(notification: NSNotification) {
        delegate?.keyboardWillShow(notification: notification)
    }

    @objc func keyboardWillHide(notification: NSNotification) {
        delegate?.keyboardWillHide(notification: notification)
    }

    @objc func keyboardDidShow(notification: NSNotification) {
        delegate?.keyboardDidShow(notification: notification)
    }

    @objc func keyboardDidHide(notification: NSNotification) {
        delegate?.keyboardDidHide(notification: notification)
    }

    @objc func keyboardWillChangeFrame(notification: NSNotification) {
        delegate?.keyboardWillChangeFrame(notification: notification)
    }
}
