import UIKit

enum EditMenuDefaultActions: String, CaseIterable {
    case define
    case translate
    case promptForReplace
    case cut
    case copy
    case paste
    case delete
    case select
    case selectAll
    case transliterateChinese
    case insertDrawing
    case captureTextFromCamera
    case toggleBoldface
    case toggleItalics
    case toggleUnderline
    case makeTextWritingDirectionRightToLeft
    case makeTextWritingDirectionLeftToRight
    case showTextFormattingOptions
    case findSelected
    case addShortcut
    case accessibilitySpeak
    case accessibilitySpeakLanguageSelection
    case accessibilityPauseSpeaking
    case share

    var selectorString: String {
        switch self {
        case .define: return "_define:"
        case .translate: return "_translate:"
        case .promptForReplace: return "_promptForReplace:"
        case .cut: return "cut:"
        case .copy: return "copy:"
        case .paste: return "paste:"
        case .delete: return "delete:"
        case .select: return "select:"
        case .selectAll: return "selectAll:"
        case .transliterateChinese: return "_transliterateChinese:"
        case .insertDrawing: return "_insertDrawing:"
        case .captureTextFromCamera: return "captureTextFromCamera:"
        case .toggleBoldface: return "toggleBoldface:"
        case .toggleItalics: return "toggleItalics:"
        case .toggleUnderline: return "toggleUnderline:"
        case .makeTextWritingDirectionRightToLeft: return "makeTextWritingDirectionRightToLeft:"
        case .makeTextWritingDirectionLeftToRight: return "makeTextWritingDirectionLeftToRight:"
        case .showTextFormattingOptions: return "_showTextFormattingOptions:"
        case .findSelected: return "_findSelected:"
        case .addShortcut: return "_addShortcut:"
        case .accessibilitySpeak: return "_accessibilitySpeak:"
        case .accessibilitySpeakLanguageSelection: return "_accessibilitySpeakLanguageSelection:"
        case .accessibilityPauseSpeaking: return "_accessibilityPauseSpeaking:"
        case .share: return "_share:"
        }
    }

    var selector: Selector {
        Selector(self.selectorString)
    }

    static func getSupportedActions(
        forResponder responder: UIResponder,
        withSender sender: Any?
    ) -> [Self] {
        Self.allCases.filter {
            responder.canPerformAction($0.selector, withSender: sender)
        }
    }
}
