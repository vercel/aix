//
//  HybridAixComposer.swift
//  Pods
//
//  Created by Fernando Rojo on 12/11/2025.
//

import Foundation
import UIKit

/// HybridAixComposer wraps the chat composer input
/// It registers itself with the AixContext so the context can track composer height
/// for calculating content insets
class HybridAixComposer: HybridAixComposerSpec {

    // MARK: - Props

    var stickToKeyboard: AixStickToKeyboard? {
        didSet {
            // When stickToKeyboard changes, re-apply transform with current keyboard state
            if let ctx = cachedAixContext {
                applyKeyboardTransform(height: ctx.keyboardHeight, heightWhenOpen: ctx.keyboardHeightWhenOpen, animated: false)
            }
        }
    }

    // MARK: - Inner View

    /// Custom UIView that notifies owner when layout changes
    private final class InnerView: UIView {
        weak var owner: HybridAixComposer?

        override func layoutSubviews() {
            super.layoutSubviews()
            owner?.handleLayoutChange()
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            owner?.handleDidMoveToWindow()
        }

        override func willMove(toSuperview newSuperview: UIView?) {
            super.willMove(toSuperview: newSuperview)
            if newSuperview == nil {
                // Being removed from superview - unregister
                owner?.handleWillRemoveFromSuperview()
            }
        }

        // MARK: - Touch Handling

        /// Let touches pass through to React Native children
        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
            return false
        }
    }

    // MARK: - Properties

    /// The UIView for this composer
    let view: UIView

    /// Cached reference to the AixContext (found on first access)
    private weak var cachedAixContext: AixContext?

    /// Last reported height (to avoid reporting unchanged heights)
    private var lastReportedHeight: CGFloat = 0

    // MARK: - Initialization

    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
    }

    // MARK: - Context Access

    /// Get the AixContext, caching it for performance
    private func getAixContext() -> AixContext? {
        if let cached = cachedAixContext {
            return cached
        }
        let ctx = view.useAixContext()
        cachedAixContext = ctx
        return ctx
    }

    // MARK: - Lifecycle Handlers

    /// Called when the view is added to a window (full hierarchy is connected)
    private func handleDidMoveToWindow() {
        guard view.window != nil else {
            return
        }

        // Clear cached context since hierarchy changed
        cachedAixContext = nil

        // Register with the new context
        if let ctx = getAixContext() {
            ctx.registerComposerView(self)
            // Initial state
            applyKeyboardTransform(height: ctx.keyboardHeight, heightWhenOpen: ctx.keyboardHeightWhenOpen, animated: false)
        }
    }

    /// Called when the view is about to be removed from superview
    private func handleWillRemoveFromSuperview() {
        // Unregister from context before removal
        if let ctx = cachedAixContext {
            ctx.unregisterComposerView(self)
        }
        cachedAixContext = nil
    }

    /// Called when layoutSubviews fires (size may have changed)
    private func handleLayoutChange() {
        let currentHeight = view.bounds.height
        if currentHeight != lastReportedHeight {
            lastReportedHeight = currentHeight
            if let ctx = cachedAixContext {
                ctx.reportComposerHeightChange(height: currentHeight)
                applyKeyboardTransform(height: ctx.keyboardHeight, heightWhenOpen: ctx.keyboardHeightWhenOpen, animated: false)
            }
        }
    }

    // MARK: - Keyboard handling

    /// Apply keyboard transform to move the composer with the keyboard
    /// Called by the AixContext when keyboard state changes
    func applyKeyboardTransform(height: CGFloat, heightWhenOpen: CGFloat, animated: Bool) {
        guard let targetView = view.superview else {
            return
        }

        guard let settings = stickToKeyboard, settings.enabled else {
            targetView.transform = .identity
            return
        }

        let progress = heightWhenOpen > 0 ? height / heightWhenOpen : 0

        let offsetWhenClosed = CGFloat(settings.offset?.whenKeyboardClosed ?? 0)
        let offsetWhenOpen = CGFloat(settings.offset?.whenKeyboardOpen ?? 0)

        let currentOffset = offsetWhenClosed + (offsetWhenOpen - offsetWhenClosed) * progress

        let translateY = -height - currentOffset

        targetView.transform = CGAffineTransform(translationX: 0, y: translateY)
    }

    // MARK: - Deinitialization
    deinit {
        cachedAixContext?.unregisterComposerView(self)
    }
}
