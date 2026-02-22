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

    // MARK: - Keyboard State (for composer sticky behavior)
    /// Current keyboard height
    var keyboardHeight: CGFloat { get }

    /// Keyboard height when fully open (for calculating progress)
    var keyboardHeightWhenOpen: CGFloat { get }
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

    /// Recursively search subviews to find the first UITextField or UITextView
    func findTextInput() -> UIView? {
        if self is UITextField || self is UITextView {
            return self
        }
        for subview in subviews {
            if let input = subview.findTextInput() {
                return input
            }
        }
        return nil
    }
}

// MARK: - HybridAix (Root Context)
class HybridAix: HybridAixSpec, AixContext, KeyboardNotificationsDelegate {

    var penultimateCellIndex: Double?
    var shouldApplyContentInsets: Bool? = nil
    var applyContentInsetDelay: Double? = nil
    var onWillApplyContentInsets: ((_ insets: AixContentInsets) -> Void)? = nil
    var onScrolledNearEndChange: ((_ isNearEnd: Bool) -> Void)? = nil

    var additionalContentInsets: AixAdditionalContentInsetsProp?

    var additionalScrollIndicatorInsets: AixScrollIndicatorInsets? {
        didSet {
            guard cachedScrollView != nil else { return }
            applyScrollIndicatorInsets()
        }
    }

    var mainScrollViewID: String? {
        didSet {
            guard mainScrollViewID != oldValue else { return }
            // Reset all scroll view and cell state when ID changes
            removeScrollViewObservers()
            cachedScrollView = nil
            didScrollToEndInitially = false
            prevIsScrolledNearEnd = nil
            blankView = nil
            cells.removeAllObjects()
            lastReportedBlankViewSize = (size: .zero, index: 0)
        }
    }
    
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
                    interpolateContentOffsetY: nil
                )
            }
            
            self.flushQueuedScrollToEnd()
        }
    }

    private var didScrollToEndInitially: Bool = false
    
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
    
    /// Previous "scrolled near end" state for change detection
    private var prevIsScrolledNearEnd: Bool? = nil

    /// KVO observation tokens for scroll view
    private var contentOffsetObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var boundsObservation: NSKeyValueObservation?
    
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
        }

        // Fallback to default subview iteration if not found by ID
        if sv == nil {
            sv = searchRoot.findScrollView()
        }

        cachedScrollView = sv

        // Set up observers when we find the scroll view
        if let scrollView = sv {
            scrollView.automaticallyAdjustsScrollIndicatorInsets = false
            setupScrollViewObservers(scrollView)
            applyScrollIndicatorInsets()
        }

        return sv
    }
    
    /// Set up KVO observers on scroll view for contentOffset, contentSize, and bounds changes
    private func setupScrollViewObservers(_ scrollView: UIScrollView) {
        // Observe contentOffset (user scrolling)
        contentOffsetObservation = scrollView.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
            self?.updateScrolledNearEndState()
        }
        
        // Observe contentSize (content size changes)
        contentSizeObservation = scrollView.observe(\.contentSize, options: [.new]) { [weak self] _, _ in
            self?.updateScrolledNearEndState()
        }
        
        // Observe bounds (parent size changes)
        boundsObservation = scrollView.observe(\.bounds, options: [.new]) { [weak self] _, _ in
            self?.updateScrolledNearEndState()
        }
    }
    
    /// Clean up KVO observers
    private func removeScrollViewObservers() {
        contentOffsetObservation?.invalidate()
        contentOffsetObservation = nil
        contentSizeObservation?.invalidate()
        contentSizeObservation = nil
        boundsObservation?.invalidate()
        boundsObservation = nil
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
        
        let startIndex: Int
        let endIndex = Int(blankView.index) - 1
        if let penultimateCellIndex {
            startIndex = Int(penultimateCellIndex)
        } else {
            startIndex = endIndex
        }
        
        var cellsBeforeBlankViewHeight: CGFloat = 0
        if startIndex <= endIndex {
            for i in startIndex...endIndex {
            if let cell = getCell(index: i) {
                    cellsBeforeBlankViewHeight += cell.view.frame.height
                }
            }
        }
        
        let blankViewHeight = blankView.view.frame.height
        
        // Calculate visible area above all bottom chrome (keyboard, composer, additional insets)
        // The blank size fills the remaining space so the last message can scroll to the top
        let visibleAreaHeight = scrollView.bounds.height - keyboardHeight - composerHeight - additionalContentInsetBottom
        let inset = visibleAreaHeight - blankViewHeight - cellsBeforeBlankViewHeight
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
        guard let _ = scrollView else { return }

        let targetTop = additionalContentInsetTop
        let targetBottom = overrideContentInsetBottom ?? self.contentInsetBottom
        
        // Create insets struct for callback
        let insets = AixContentInsets(
            top: Double(targetTop),
            left: nil,
            bottom: Double(targetBottom),
            right: nil
        )

        onWillApplyContentInsets?(insets)
        
        if shouldApplyContentInsets == false {
            return
        }
        
        // Helper to actually apply the insets
        let applyInsets = { [weak self] in
            guard let self, let scrollView = self.scrollView else { return }
            if scrollView.contentInset.top != targetTop {
                scrollView.contentInset.top = targetTop
            }
            if scrollView.contentInset.bottom != targetBottom {
                scrollView.contentInset.bottom = targetBottom
            }
            // Update scrolled near end state after insets change
            self.updateScrolledNearEndState()
        }
        
        // Apply with optional delay
        if let delay = applyContentInsetDelay, delay > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay / 1000.0, execute: applyInsets)
        } else {
            applyInsets()
        }
    }

    /// Centralized function to check and fire onScrolledNearEndChange callback
    private func updateScrolledNearEndState() {
        guard didScrollToEndInitially, scrollView != nil else { return }
        let isNearEnd = getIsScrolledNearEnd(distFromEnd: distFromEnd)
        guard isNearEnd != prevIsScrolledNearEnd else { return }
        prevIsScrolledNearEnd = isNearEnd
        onScrolledNearEndChange?(isNearEnd)
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

    /// Apply both content insets and scroll indicator insets
    private func applyAllInsets() {
        applyContentInset()
        applyScrollIndicatorInsets()
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

    
    // MARK: - Keyboard Management
    private lazy var keyboardNotifications: KeyboardNotifications = {
        return KeyboardNotifications(notifications: [.willShow, .willHide, .didShow, .didHide, .willChangeFrame], delegate: self)
    }()
    
    /// Event captured at the start of a keyboard transition
    private struct KeyboardStartEvent {
        let scrollY: CGFloat
        let isOpening: Bool
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
        
        let scrollY = scrollView?.contentOffset.y ?? 0
        
        var interpolateContentOffsetY: (CGFloat, CGFloat)? = {
            if isOpening {
                return self.getContentOffsetYWhenOpening(scrollY: scrollY)
            } else {
                return self.getContentOffsetYWhenClosing(scrollY: scrollY)
            }
        }()
        
        if queuedScrollToEnd != nil {
            interpolateContentOffsetY = nil
        }
        
        startEvent = KeyboardStartEvent(
            scrollY: scrollY,
            isOpening: isOpening,
            interpolateContentOffsetY: interpolateContentOffsetY
        )
    }
    
    /// Handle keyboard animation end
    private func handleKeyboardDidMove(height: CGFloat, progress: CGFloat) {
        keyboardHeight = height
        if keyboardHeightWhenOpen > 0 {
            keyboardProgress = height / keyboardHeightWhenOpen
        }

        applyAllInsets()

        startEvent = nil
        
        if queuedScrollToEnd?.waitForKeyboardToEnd == true {
            flushQueuedScrollToEnd(force: true)
        }
    }
    
    // MARK: - Initialization
    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
        // Attach this context to our inner view
        view.aixContext = self
    }
    
    deinit {
        removeScrollViewObservers()
    }
    
    // MARK: - Lifecycle
    /// Called when our view is added to or removed from the HybridAixComponent
    private func handleDidMoveToSuperview() {
        if let superview = view.superview {
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

        // Initial mount setup (tied to mainScrollViewID)
        if !didScrollToEndInitially {
            UIView.performWithoutAnimation {
                applyAllInsets()
                
                if shouldStartAtEnd {
                    scrollToEndInternal(animated: false)
                }
                
                // Set initial state based on actual scroll position after layout
                prevIsScrolledNearEnd = getIsScrolledNearEnd(distFromEnd: distFromEnd)
            }
            
            // Enable callbacks only after all setup is complete
            didScrollToEndInitially = true
            return
        }
        
        applyAllInsets()

        if let queued = queuedScrollToEnd, index == queued.index {
            flushQueuedScrollToEnd()
        }
    }
    
    func registerCell(_ cell: HybridAixCellView) {
        cells.setObject(cell, forKey: NSNumber(value: cell.index))
        
        // If this cell is marked as last, update our blank view reference
        if cell.isLast {
            blankView = cell

            // Trigger initial setup - handleLayoutChange may have already fired before
            // the cell was in window, so we need to report here to ensure setup happens
            let currentSize = cell.view.bounds.size
            reportBlankViewSizeChange(size: currentSize, index: Int(cell.index))
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
        guard height != lastReportedComposerHeight else { return }
        lastReportedComposerHeight = height
        
        guard didScrollToEndInitially else { return }
        
        let shouldScroll = shouldScrollOnFooterSizeUpdate()
        applyAllInsets()
        
        if shouldScroll {
            let animated = scrollOnFooterSizeUpdate?.animated ?? false
            scrollToEndInternal(animated: animated)
        }
    }

    private func shouldScrollOnFooterSizeUpdate() -> Bool {
        guard let settings = scrollOnFooterSizeUpdate, settings.enabled ?? true else {
            return false
        }
        guard scrollView != nil else {
            return false
        }

        let threshold = settings.scrolledToEndThreshold ?? 100
        return distFromEnd <= CGFloat(threshold)
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

        guard duration > 0 else { return }

        if targetHeight > keyboardHeightWhenOpen {
            keyboardHeightWhenOpen = targetHeight
        }

        if !didScrollToEndInitially {
            keyboardHeight = targetHeight
            keyboardProgress = 1.0
            applyAllInsets()
            composerView?.applyKeyboardTransform(height: targetHeight, heightWhenOpen: keyboardHeightWhenOpen, animated: false)
            return
        }

        handleKeyboardWillMove(targetHeight: targetHeight, isOpening: true)

        let options = UIView.AnimationOptions(rawValue: curveValue << 16)
        UIView.animate(withDuration: duration, delay: 0, options: options, animations: { [weak self] in
            guard let self else { return }
            keyboardHeight = targetHeight
            if keyboardHeightWhenOpen > 0 {
                keyboardProgress = targetHeight / keyboardHeightWhenOpen
            }
            applyAllInsets()
            composerView?.applyKeyboardTransform(height: targetHeight, heightWhenOpen: keyboardHeightWhenOpen, animated: false)

            if let (_, endY) = startEvent?.interpolateContentOffsetY {
                scrollView?.setContentOffset(CGPoint(x: 0, y: endY), animated: false)
            }
        }, completion: { [weak self] _ in
            self?.handleKeyboardDidMove(height: targetHeight, progress: 1.0)
        })
    }

    func keyboardWillHide(notification: NSNotification) {
        guard let userInfo = notification.userInfo,
              let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double,
              let curveValue = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt else { return }

        startEvent = nil

        let options = UIView.AnimationOptions(rawValue: curveValue << 16)
        UIView.animate(withDuration: duration, delay: 0, options: options, animations: { [weak self] in
            guard let self else { return }
            keyboardHeight = 0
            keyboardProgress = 0
            applyAllInsets()
            composerView?.applyKeyboardTransform(height: 0, heightWhenOpen: keyboardHeightWhenOpen, animated: false)
        }, completion: { [weak self] _ in
            self?.handleKeyboardDidMove(height: 0, progress: 0)
        })
    }

    func keyboardDidShow(notification: NSNotification) {
    }

    func keyboardDidHide(notification: NSNotification) {
        keyboardHeightWhenOpen = 0
        composerView?.applyKeyboardTransform(height: 0, heightWhenOpen: 0, animated: false)
    }

    func keyboardWillChangeFrame(notification: NSNotification) {
    }
}

// MARK: - Scroll Position Helpers
extension HybridAix {
    /// Distance from current scroll position to the maximum scroll position (end)
    var distFromEnd: CGFloat {
        guard let scrollView else { return 0 }
        return scrollView.contentSize.height - scrollView.bounds.height + contentInsetBottom - scrollView.contentOffset.y
    }
    
    func getIsScrolledNearEnd(distFromEnd: CGFloat) -> Bool {
        guard scrollView != nil else { return false }
        return distFromEnd <= (scrollEndReachedThreshold ?? max(200, blankSize))
    }

    func getContentOffsetYWhenOpening(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard let scrollView, getIsScrolledNearEnd(distFromEnd: distFromEnd), blankSize <= keyboardHeightWhenOpen else {
            return nil
        }
        
        let targetAdditionalInset = CGFloat(additionalContentInsets?.bottom?.whenKeyboardOpen ?? 0)
        let targetY = scrollView.contentSize.height - scrollView.bounds.height + keyboardHeightWhenOpen + composerHeight + targetAdditionalInset
        
        return (scrollY, targetY)
    }
    
    func getContentOffsetYWhenClosing(scrollY: CGFloat) -> (CGFloat, CGFloat)? {
        guard scrollView != nil, keyboardHeightWhenOpen > 0, getIsScrolledNearEnd(distFromEnd: distFromEnd) else {
            return nil
        }

        let additionalInsetOpen = CGFloat(additionalContentInsets?.bottom?.whenKeyboardOpen ?? 0)
        let additionalInsetClosed = CGFloat(additionalContentInsets?.bottom?.whenKeyboardClosed ?? 0)
        
        let blankSizeOpen = calculateBlankSize(keyboardHeight: keyboardHeightWhenOpen, additionalContentInsetBottom: additionalInsetOpen)
        let blankSizeClosed = calculateBlankSize(keyboardHeight: 0, additionalContentInsetBottom: additionalInsetClosed)
        
        let insetOpen = calculateContentInsetBottom(keyboardHeight: keyboardHeightWhenOpen, blankSize: blankSizeOpen, additionalContentInsetBottom: additionalInsetOpen)
        let insetClosed = calculateContentInsetBottom(keyboardHeight: 0, blankSize: blankSizeClosed, additionalContentInsetBottom: additionalInsetClosed)
        
        let targetScrollY = max(0, scrollY - (insetOpen - insetClosed))
        
        guard abs(scrollY - targetScrollY) > 1 else { return nil }
        return (scrollY, targetScrollY)
    }
}
