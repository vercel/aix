//
//  HybridAixBlank.swift
//  Pods
//
//  Created by Fernando Rojo on 12/11/2025.
//

import Foundation
import UIKit

/// HybridAixCellView wraps each list item in the chat (the "blank" cell at the end)
/// It tracks its index and whether it's the last item,
/// and reports size changes to the AixContext
class HybridAixCellView: HybridAixCellViewSpec {
    
    
    // MARK: - Inner View
    
    /// Custom UIView that notifies owner when layout changes
    private final class InnerView: UIView {
        weak var owner: HybridAixCellView?
        
        override func layoutSubviews() {
            super.layoutSubviews()
            owner?.handleLayoutChange()
        }
        
        override func didMoveToSuperview() {
            super.didMoveToSuperview()
            owner?.handleDidMoveToSuperview()
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
    
    // MARK: - Initialization
    
    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
        print("HybridAixCellView init: index=\(index), isLast=\(isLast)")
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
    
    /// Called when the view is added to a superview
    private func handleDidMoveToSuperview() {
        // Don't register here - hierarchy may not be complete yet
        // Wait for didMoveToWindow instead
    }
    
    /// Called when the view is added to a window (full hierarchy is connected)
    private func handleDidMoveToWindow() {
        print("[Aix] CellView didMoveToWindow: index=\(index)")
        guard view.window != nil else { return }
        
        // Clear cached context since hierarchy changed
        cachedAixContext = nil
        
        // Register with the new context
        if let ctx = getAixContext() {
            ctx.registerCell(self)
        }
    }
    
    /// Called when the view is about to be removed from superview
    private func handleWillRemoveFromSuperview() {
        // Unregister from context before removal
        if let ctx = cachedAixContext {
            ctx.unregisterCell(self)
        }
        cachedAixContext = nil
    }
    
    /// Called when layoutSubviews fires (size may have changed)
    private func handleLayoutChange() {
        guard let ctx = getAixContext() else { return }
        
        // Re-register to ensure context has latest reference
        ctx.registerCell(self)
        
        // If we're the last cell, report size change
        if isLast {
            ctx.reportBlankViewSizeChange(size: view.bounds.size, index: Int(index))
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
        guard let ctx = getAixContext() else { return }
        
        if isLast {
            // This cell is now the last one - become the blank view
            ctx.blankView = self
            ctx.reportBlankViewSizeChange(size: view.bounds.size, index: Int(index))
        } else if ctx.blankView === self {
            // This cell is no longer last - clear blank view reference
            ctx.blankView = nil
        }
    }
}
