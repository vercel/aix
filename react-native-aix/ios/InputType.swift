import UIKit

final class WeakRef<T> {
    public weak var rawRef: AnyObject?

    public var ref: T? {
        self.rawRef as? T
    }

    public init(with ref: T) {
        self.rawRef = ref as AnyObject
    }

    public init?(with ref: T?) {
        guard let unwrappedRef = ref else { return nil }
        self.rawRef = unwrappedRef as AnyObject
    }
}

enum InputType {
    case textField(WeakRef<UITextField>)
    case textView(WeakRef<UITextView>)

    var textInput: UITextInput? {
        switch self {
        case let .textField(textField):
            return textField.ref
        case let .textView(textView):
            return textView.ref
        }
    }

    init(textField: UITextField) {
        self = .textField(.init(with: textField))
    }

    init(textView: UITextView) {
        self = .textView(.init(with: textView))
    }
}
