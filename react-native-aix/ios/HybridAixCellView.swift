//
//  HybridAixBlank.swift
//  Pods
//
//  Created by Fernando Rojo on 12/11/2025.
//

import Foundation
import os.log
import UIKit

private let log = Logger(subsystem: "com.aix", category: "cell")

/// HybridAixCellView wraps each list item in the chat (the "blank" cell at the end)
/// It tracks its index and whether it's the last item,
/// and reports size changes to the AixContext
class HybridAixCellView: HybridAixCellViewSpec {

    // MARK: - Inner View

    /// Custom UIView that notifies owner when layout changes
    private final class InnerView: UIView {
        weak var owner: HybridAixCellView?

        override init(frame: CGRect) {
            super.init(frame: frame)
            autoresizingMask = [.flexibleWidth]
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// Let touches pass through to React Native children
        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
            return false
        }

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
    }
    
    // MARK: - Properties
    
    /// The UIView for this cell
    let view: UIView
    
    /// The index of this cell in the list
    var index: Double = 0 {
        didSet {
            if oldValue != index {
                updateRegistration()
            }
        }
    }
    
    /// Whether this is the last cell in the list
    /// When true, this cell becomes the "blank view" used for calculating scroll offsets
    var isLast: Bool = false {
        didSet {
            if oldValue != isLast {
                updateBlankViewStatus()
            }
        }
    }
    
    /// Cached reference to the AixContext (found on first access)
    private weak var cachedAixContext: AixContext?
    
    /// Last reported size (to avoid reporting unchanged sizes)
    private var lastReportedSize: CGSize = .zero
    
    // MARK: - Initialization
    
    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
        getAixContext()?.registerCell(self)
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
            log.debug("didMoveToWindow index=\(self.index) isLast=\(self.isLast) — no window")
            return
        }

        log.debug("didMoveToWindow index=\(self.index) isLast=\(self.isLast)")

        // Clear cached context since hierarchy changed
        cachedAixContext = nil

        // Reset lastReportedSize so handleLayoutChange will fire even if
        // the cell is reused with the same dimensions, and mark the view
        // dirty so layoutSubviews is guaranteed to fire on the next pass
        // (which is when contentSize is correct for scroll-to-end).
        lastReportedSize = .zero
        view.setNeedsLayout()

        // Register with the new context
        getAixContext()?.registerCell(self)
    }

    /// Called when the view is about to be removed from superview
    private func handleWillRemoveFromSuperview() {
        log.debug("willRemoveFromSuperview index=\(self.index) isLast=\(self.isLast)")
        // Unregister from context before removal
        cachedAixContext?.unregisterCell(self)
        cachedAixContext = nil
    }

    /// Called when layoutSubviews fires (size may have changed)
    private func handleLayoutChange() {
        // Only report size changes for the last cell (blank view)
        // and only if the size actually changed
        let currentSize = view.bounds.size
        if isLast && currentSize != lastReportedSize {
            log.debug("layoutChange index=\(self.index) size=\(self.lastReportedSize.debugDescription) → \(currentSize.debugDescription)")
            lastReportedSize = currentSize
            getAixContext()?.reportBlankViewSizeChange(size: currentSize, index: Int(index))
        }
    }
    
    // MARK: - Registration
    
    /// Update registration with context (called when index changes)
    private func updateRegistration() {
        guard let ctx = getAixContext() else { return }
        ctx.registerCell(self)
    }
    
    /// Update blank view status (called when isLast changes)
    private func updateBlankViewStatus() {
        guard let ctx = getAixContext() else {
            log.warning("updateBlankViewStatus index=\(self.index) isLast=\(self.isLast) — no AixContext")
            return
        }

        if isLast {
            log.debug("updateBlankViewStatus index=\(self.index) isLast=true — setting blankView, size=\(self.view.bounds.size.debugDescription)")
            ctx.blankView = self
            let currentSize = view.bounds.size
            lastReportedSize = currentSize
            ctx.reportBlankViewSizeChange(size: currentSize, index: Int(index))
        } else if ctx.blankView === self {
            log.debug("updateBlankViewStatus index=\(self.index) isLast=false — clearing blankView")
            ctx.blankView = nil
        }
    }
}
