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

protocol AixContext: AnyObject {
    var blankView: HybridAixBlankView? { get set }
    var composerView: HybridAixComposer? { get set }
    
    func reportBlankViewSizeChange(size: CGSize, index: Int)
    
}

extension UIView {
    var aixContext: AixContext? {
        get { objc_getAssociatedObject(self, &aixContextKey) as? AixContext }
        set { objc_setAssociatedObject(self, &aixContextKey, newValue, .OBJC_ASSOCIATION_ASSIGN) }
    }

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

class HybridAix: HybridAixSpec, AixContext {
    var view: UIView = UIView()
    var keyboardHeight: CGFloat = 0
    
    // props
    var shouldStartAtEnd: Bool = true
    var scrollOnComposerSizeUpdate: Bool = false

    private struct BlankSizeMeasurement {
        var height: CGFloat
        var index: Int
    }

    private struct QueuedScrollToEnd {
        var index: Int
        var animated: Bool
    }

    private var queuedScrollToEnd: QueuedScrollToEnd? = nil
    
    weak var blankView = nil as HybridAixBlankView? {
        didSet {
            
        }
    }
    weak var composerView = nil as HybridAixComposer?
    weak var scrollView: UIScrollView? {
        return view.findScrollView()
    }
    var blankSize: CGFloat {
        var blankViewSize = blankView?.view.bounds.height ?? 0

        // height of the parent scrollable area minus blankViewSize
        guard let scrollView = scrollView else { return 0 }

        return scrollView.bounds.height - blankViewSize - keyboardHeight
    }
    
    override init() {
        super.init()
        view.aixContext = self
    }

    func scrollToEndOnBlankSizeUpdate(index: Int) {
        if let blankView, index == blankView.index {
          scrollToEnd(animated: true)
        } else {
          queuedScrollToEnd = QueuedScrollToEnd(index: index, animated: true)
        }
    }

    func reportBlankViewSizeChange(size: CGSize, index: Int) {
        if let queuedScrollToEnd = queuedScrollToEnd, index == queuedScrollToEnd.index {
            scrollToEnd(animated: queuedScrollToEnd.animated)
            self.queuedScrollToEnd = nil
        }
    }

    private var composerHeight: CGFloat {
        return composerView?.view.bounds.height ?? 0
    }
    var scrollViewContentOffsetBottom: CGFloat {
        var bottom = blankSize + keyboardHeight + composerHeight
        
        return bottom
    }
    
    private func scrollToEnd(animated: Bool) {
        let offset = blankSize
        guard let scrollView = scrollView else { return }

        let bottomOffset = CGPoint(
            x: 0,
            y: max(0, scrollView.contentSize.height - scrollView.bounds.height + offset)
        )
        scrollView.setContentOffset(bottomOffset, animated: animated)
    }
}
