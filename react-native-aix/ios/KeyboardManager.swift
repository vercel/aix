//
//  KeyboardManager.swift
//  Aix
//
//  Created by Fernando Rojo on 12/12/2025.
//

import Foundation
import UIKit

/// Delegate protocol for receiving keyboard events
protocol KeyboardManagerDelegate: AnyObject {
    /// Called on each frame as the keyboard animates
    /// - Parameters:
    ///   - height: Current keyboard height
    ///   - progress: Animation progress from 0 to 1
    func keyboardManager(_ manager: KeyboardManager, didUpdateHeight height: CGFloat, progress: CGFloat)
    
    /// Called when keyboard animation starts
    func keyboardManagerDidStartAnimation(_ manager: KeyboardManager, event: KeyboardManager.KeyboardEvent)
    
    /// Called when an ongoing keyboard animation becomes interactive (user started scrolling to dismiss)
    func keyboardManagerDidBecomeInteractive(_ manager: KeyboardManager)
    
    /// Called when keyboard animation ends
    func keyboardManagerDidEndAnimation(_ manager: KeyboardManager)
}

/// Manages keyboard observation and provides frame-by-frame height tracking
class KeyboardManager {
    
    // MARK: - Types
    
    /// Keyboard event state captured at the start of a keyboard transition
    struct KeyboardEvent {
        let startHeight: CGFloat
        let targetHeight: CGFloat
        let isOpening: Bool
        let isInteractive: Bool
    }
    
    /// Weak target wrapper to avoid CADisplayLink retain cycle
    private class DisplayLinkTarget {
        weak var owner: KeyboardManager?
        
        init(owner: KeyboardManager) {
            self.owner = owner
        }
        
        @objc func handleDisplayLink(_ displayLink: CADisplayLink) {
            owner?.trackFrame()
        }
    }
    
    // MARK: - Properties
    
    weak var delegate: KeyboardManagerDelegate?
    
    /// Current keyboard height
    private(set) var currentHeight: CGFloat = 0
    
    /// Current keyboard event (nil when no animation is active)
    private(set) var currentEvent: KeyboardEvent?
    
    // MARK: - Private Properties
    
    private var displayLink: CADisplayLink?
    private var displayLinkTarget: DisplayLinkTarget?
    private weak var keyboardView: UIView?
    
    // MARK: - Initialization
    
    init() {
        setupObservers()
    }
    
    deinit {
        removeObservers()
        stopTracking()
    }
    
    // MARK: - Observers
    
    private func setupObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillShow(_:)),
            name: UIResponder.keyboardWillShowNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillChangeFrame(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
    }
    
    private func removeObservers() {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Notification Handlers
    
    @objc private func keyboardWillShow(_ notification: Notification) {
        // Only handle if we don't already have an event (prevents duplicate from keyboardWillChangeFrame)
        guard currentEvent == nil else { return }
        handleNotification(notification, isShowing: true)
    }
    
    @objc private func keyboardWillHide(_ notification: Notification) {
        // Only handle if we don't already have an event (prevents duplicate from keyboardWillChangeFrame)
        guard currentEvent == nil else { return }
        handleNotification(notification, isShowing: false)
    }
    
    @objc private func keyboardWillChangeFrame(_ notification: Notification) {
        let duration = (notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
        let isInteractive = duration == 0
        
        // If we already have an event that's NOT interactive, but this frame change IS interactive,
        // then the user started an interactive dismissal - notify delegate
        if let event = currentEvent, !event.isInteractive && isInteractive {
            upgradeToInteractive()
            return
        }
        
        // Only handle if we don't already have an event AND it's an interactive event (duration == 0)
        guard currentEvent == nil else { return }
        
        // For non-interactive events, let keyboardWillShow/Hide handle it
        guard isInteractive else { return }
        
        handleNotification(notification, isShowing: nil)
    }
    
    /// Upgrades the current event to interactive mode
    private func upgradeToInteractive() {
        guard let event = currentEvent, !event.isInteractive else { return }
        
        // Create a new event with isInteractive = true
        let interactiveEvent = KeyboardEvent(
            startHeight: event.startHeight,
            targetHeight: event.targetHeight,
            isOpening: event.isOpening,
            isInteractive: true
        )
        currentEvent = interactiveEvent
        
        delegate?.keyboardManagerDidBecomeInteractive(self)
    }
    
    private func handleNotification(_ notification: Notification, isShowing: Bool?) {
        guard let userInfo = notification.userInfo,
              let endFrame = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }
        
        let screenHeight = UIScreen.main.bounds.height
        let targetHeight = max(0, screenHeight - endFrame.origin.y)
        let isOpening = isShowing ?? (targetHeight > currentHeight)
        
        // Determine if this is an interactive dismissal by checking animation duration
        // Interactive dismissals have duration == 0 because animation follows user's finger
        let duration = (userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
        let isInteractive = duration == 0
        
        // Find keyboard view (needed for frame-by-frame tracking)
        findKeyboardView()
        
        let event = KeyboardEvent(
            startHeight: currentHeight,
            targetHeight: targetHeight,
            isOpening: isOpening,
            isInteractive: isInteractive
        )
        
        currentEvent = event
        delegate?.keyboardManagerDidStartAnimation(self, event: event)
        
        startTracking()
    }
    
    // MARK: - Keyboard View Finding
    
    private func findKeyboardView() {
        if keyboardView != nil { return }
        
        for window in UIApplication.shared.windows {
            let windowName = NSStringFromClass(type(of: window))
            
            if windowName.contains("UIRemoteKeyboardWindow") {
                if let hostView = findViewOfType(in: window, typeName: "UIInputSetHostView") {
                    keyboardView = hostView
                    return
                }
                keyboardView = window
                return
            }
            
            if windowName.contains("UITextEffectsWindow") {
                if let hostView = findViewOfType(in: window, typeName: "UIInputSetHostView") {
                    keyboardView = hostView
                    return
                }
            }
        }
        
        for window in UIApplication.shared.windows {
            if let inputView = findViewOfType(in: window, typeName: "UIInputSetContainerView") {
                keyboardView = inputView
                return
            }
            if let inputView = findViewOfType(in: window, typeName: "UIKeyboard") {
                keyboardView = inputView
                return
            }
        }
    }
    
    private func findViewOfType(in view: UIView, typeName: String, maxDepth: Int = 5) -> UIView? {
        // Use NSStringFromClass which is more efficient than String(describing:)
        let className = NSStringFromClass(type(of: view))
        if className.contains(typeName) {
            return view
        }
        // Limit search depth - keyboard views are never deeply nested
        guard maxDepth > 0 else { return nil }
        for subview in view.subviews {
            if let found = findViewOfType(in: subview, typeName: typeName, maxDepth: maxDepth - 1) {
                return found
            }
        }
        return nil
    }
    
    // MARK: - Display Link Tracking
    
    private func startTracking() {
        guard displayLink == nil else { return }
        
        // Use weak target wrapper to avoid retain cycle
        let target = DisplayLinkTarget(owner: self)
        displayLinkTarget = target
        displayLink = CADisplayLink(target: target, selector: #selector(DisplayLinkTarget.handleDisplayLink(_:)))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func stopTracking() {
        displayLink?.invalidate()
        displayLink = nil
        displayLinkTarget = nil
        currentEvent = nil
        delegate?.keyboardManagerDidEndAnimation(self)
    }
    
    private func trackFrame() {
        guard let event = currentEvent else {
            stopTracking()
            return
        }
        
        let height = getKeyboardHeight()
        
        // Calculate progress
        let totalDistance = abs(event.targetHeight - event.startHeight)
        let currentDistance = abs(height - event.startHeight)
        let progress = totalDistance > 0 ? min(1, currentDistance / totalDistance) : 1
        
        currentHeight = height
        delegate?.keyboardManager(self, didUpdateHeight: height, progress: progress)
        
        // Stop when we reach the target
        if abs(height - event.targetHeight) < 1 {
            currentHeight = event.targetHeight
            delegate?.keyboardManager(self, didUpdateHeight: event.targetHeight, progress: 1)
            stopTracking()
        }
    }
    
    private func getKeyboardHeight() -> CGFloat {
        guard let keyboardView = keyboardView else {
            return currentEvent?.targetHeight ?? currentHeight
        }
        
        let presentationFrame = keyboardView.layer.presentation()?.frame ?? keyboardView.frame
        let screenHeight = UIScreen.main.bounds.height
        let windowFrame = keyboardView.superview?.convert(presentationFrame, to: nil) ?? presentationFrame
        
        return max(0, screenHeight - windowFrame.origin.y)
    }
}

