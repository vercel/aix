

import Foundation
import UIKit

class HybridAixComposer : HybrixAixCellViewSpec {
  // UIView
  var view: UIView = UIView()

  // Props
  var isLast: Bool = false {
    didSet {
      view.backgroundColor = isLast ? .green : .black
    }
  }
}

