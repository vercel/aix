import Foundation
import UIKit

class HybridAixBlankView : HybridAixBlankViewSpec {
    private final class InnerView: UIView {
        weak var owner: HybridAixBlankView?

        override func layoutSubviews() {
            super.layoutSubviews()
            owner?.blankViewDidChange(to: bounds.size)
        }
    }

    let view: UIView
    
    var index: Int = 0
    
    weak var aixContext: AixContext?
    
    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
        self.aixContext = inner.useAixContext()
    }
    
    private func blankViewDidChange(to size: CGSize) {
        reportIfLast()
    }
    
    func reportIfLast() {
        if isLast, let ctx = aixContext {
            ctx.blankView = self
        }
    }
    
      var isLast: Bool = false {
        didSet {
            reportIfLast()
        }
      }
    
}
