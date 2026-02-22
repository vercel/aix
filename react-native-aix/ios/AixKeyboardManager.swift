//
//  AixKeyboardManager.swift
//  Aix
//
//  Keyboard notification manager for tracking keyboard state.
//

import Foundation
import UIKit

// Source - https://stackoverflow.com/a
// Posted by Vasily Bodnarchuk, modified by community. See post 'Timeline' for change history
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

class KeyboardNotifications: NSObject {
    fileprivate var _isEnabled: Bool
    fileprivate var notifications: [KeyboardNotificationsType]
    fileprivate weak var delegate: KeyboardNotificationsDelegate?

    init(notifications: [KeyboardNotificationsType], delegate: KeyboardNotificationsDelegate) {
        _isEnabled = false
        self.notifications = notifications
        self.delegate = delegate
        super.init()
    }

    deinit { isEnabled = false }
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
