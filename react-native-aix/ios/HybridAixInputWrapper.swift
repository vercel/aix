import Foundation
import UIKit
import UniformTypeIdentifiers
import ObjectiveC.runtime

private let LOG_TAG = "[AixInputWrapper]"

fileprivate enum NativeIDKey: String {
    case textInput
}

private var allowedActionsKey: UInt8 = 0

class HybridAixInputWrapper: HybridAixInputWrapperSpec {

    // MARK: - Props
    var pasteConfiguration: [String]?
    var editMenuDefaultActions: [String]? {
        didSet {
            self.parsedEditMenuActions = editMenuDefaultActions?
                .compactMap { EditMenuDefaultActions(rawValue: $0) }
        }
    }
    var maxLines: Double?
    var maxChars: Double?
    var onPaste: ((_ events: [AixInputWrapperOnPasteEvent]) -> Void)?

    // MARK: - Private State
    private var parsedEditMenuActions: [EditMenuDefaultActions]?
    private var wrappedTextInput: InputType?
    private let dropDelegate = ImageDropDelegate()
    private lazy var pasteDelegate = PasteHandlerDelegate(owner: self)

    // MARK: - Inner View
    private final class InnerView: UIView {
        weak var owner: HybridAixInputWrapper?

        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
            return false
        }

        override func didMoveToSuperview() {
            super.didMoveToSuperview()
            scheduleAttach()
        }

        override func didAddSubview(_ subview: UIView) {
            super.didAddSubview(subview)
            scheduleAttach()
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            scheduleAttach()
        }

        private func scheduleAttach() {
            guard owner?.wrappedTextInput == nil else { return }
            DispatchQueue.main.async { [weak self] in
                self?.owner?.attachIfPossible()
            }
        }

        override func willMove(toSuperview newSuperview: UIView?) {
            super.willMove(toSuperview: newSuperview)
            if newSuperview == nil {
                owner?.wrappedTextInput = nil
            }
        }
    }

    let view: UIView

    // MARK: - Init
    override init() {
        let inner = InnerView()
        self.view = inner
        super.init()
        inner.owner = self
    }

    // MARK: - Paste Handling
    func handlePaste() {
        print("\(LOG_TAG) Paste triggered")
        PasteFileManager.cleanupOldFiles()
        let pb = UIPasteboard.general

        if let images = pb.images, images.count > 0 {
            print("\(LOG_TAG) Pasting \(images.count) image(s)")
            saveImages(images) { [weak self] events in
                if !events.isEmpty {
                    self?.onPaste?(events)
                }
            }
        } else if let url = pb.url {
            Task { [weak self] in
                if let image = await self?.fetchImage(from: url) {
                    self?.saveImages([image]) { events in
                        if !events.isEmpty {
                            self?.onPaste?(events)
                        }
                    }
                }
            }
        } else if !pb.itemProviders.isEmpty {
            checkForFiles(itemProviders: pb.itemProviders) { [weak self] events in
                if !events.isEmpty {
                    self?.onPaste?(events)
                }
            }
        }
    }

    func saveImages(_ images: [UIImage], completion: @escaping ([AixInputWrapperOnPasteEvent]) -> Void) {
        var events: [AixInputWrapperOnPasteEvent] = []
        for image in images {
            if let uri = try? PasteFileManager.save(image: image) {
                let fileURL = URL(fileURLWithPath: uri)
                let ext = fileURL.pathExtension
                print("\(LOG_TAG) Image saved to \(uri)")
                events.append(AixInputWrapperOnPasteEvent(
                    type: "image",
                    filePath: uri,
                    fileExtension: ext,
                    fileName: fileURL.lastPathComponent
                ))
            }
        }
        completion(events)
    }

    // MARK: - Text Input Attachment
    func attachIfPossible() {
        guard wrappedTextInput == nil else { return }
        let searchRoot = view.superview ?? view
        guard let input = findTextInput(in: searchRoot) else {
            print("\(LOG_TAG) No text input found in subview hierarchy")
            return
        }

        let onImageHandler: (UIImage) -> Void = { [weak self] image in
            self?.saveImages([image]) { events in
                if !events.isEmpty {
                    self?.onPaste?(events)
                }
            }
        }
        dropDelegate.onImage = onImageHandler

        (view as? InnerView).map { $0.addInteraction(UIDropInteraction(delegate: dropDelegate)) }

        let acceptableTypes = [
            UTType.image.identifier,
            UTType.pdf.identifier,
            UTType.svg.identifier,
            UTType.url.identifier,
            UTType.text.identifier
        ]

        if let tf = input as? UITextField {
            print("\(LOG_TAG) Found UITextField, attaching paste delegate")
            self.wrappedTextInput = .init(textField: tf)
            tf.pasteConfiguration = .init(acceptableTypeIdentifiers: acceptableTypes)
            tf.pasteDelegate = pasteDelegate
            tf.addInteraction(UIDropInteraction(delegate: dropDelegate))
            applyEditMenuFilter(to: tf)
        } else if let tv = input as? UITextView {
            print("\(LOG_TAG) Found UITextView, attaching paste delegate")
            self.wrappedTextInput = .init(textView: tv)
            tv.pasteConfiguration = .init(acceptableTypeIdentifiers: acceptableTypes)
            tv.pasteDelegate = pasteDelegate
            tv.addInteraction(UIDropInteraction(delegate: dropDelegate))
            applyEditMenuFilter(to: tv)
        }
    }

    private func findTextInput(in root: UIView) -> UIView? {
        if root is UITextField { return root }
        if root is UITextView { return root }
        for sub in root.subviews {
            if let found = findTextInput(in: sub) { return found }
        }
        return nil
    }

    private func applyEditMenuFilter(to input: UIView) {
        guard let actions = parsedEditMenuActions else { return }
        let allowedSelectors = actions.map { $0.selector }
        objc_setAssociatedObject(input, &allowedActionsKey, allowedSelectors, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        swizzleCanPerformAction(on: input)
        print("\(LOG_TAG) Applied edit menu filter: \(actions.map { $0.rawValue })")
    }

    private func swizzleCanPerformAction(on view: UIView) {
        let originalClass: AnyClass = type(of: view)
        let className = "AixSwizzled_\(NSStringFromClass(originalClass))"

        if let existingClass = objc_getClass(className) as? AnyClass {
            object_setClass(view, existingClass)
            return
        }

        guard let subclass = objc_allocateClassPair(originalClass, className, 0) else { return }

        let swizzledCanPerform: @convention(block) (AnyObject, Selector, Any?) -> Bool = { obj, action, sender in
            guard let allowed = objc_getAssociatedObject(obj, &allowedActionsKey) as? [Selector] else {
                struct Holder { static let sel = #selector(UIResponder.canPerformAction(_:withSender:)) }
                let superImp = class_getMethodImplementation(class_getSuperclass(type(of: obj)), Holder.sel)
                let superFn = unsafeBitCast(superImp, to: (@convention(c) (AnyObject, Selector, Selector, Any?) -> Bool).self)
                return superFn(obj, Holder.sel, action, sender)
            }
            return allowed.contains(action)
        }

        let imp = imp_implementationWithBlock(swizzledCanPerform)
        let sel = #selector(UIResponder.canPerformAction(_:withSender:))
        let method = class_getInstanceMethod(originalClass, sel)!
        let typeEncoding = method_getTypeEncoding(method)!
        class_addMethod(subclass, sel, imp, typeEncoding)

        objc_registerClassPair(subclass)
        object_setClass(view, subclass)
    }

    // MARK: - Helpers
    func fetchImage(from url: URL) async -> UIImage? {
        var req = URLRequest(url: url)
        req.timeoutInterval = 20
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
            return UIImage(data: data)
        } catch {
            return nil
        }
    }

    func checkForFiles(itemProviders: [NSItemProvider], completion: @escaping ([AixInputWrapperOnPasteEvent]) -> Void) {
        var events: [AixInputWrapperOnPasteEvent] = []
        let group = DispatchGroup()

        for provider in itemProviders {
            if provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) {
                group.enter()
                provider.loadDataRepresentation(forTypeIdentifier: UTType.pdf.identifier) { data, _ in
                    defer { group.leave() }
                    guard let data else { return }
                    if let uri = try? PasteFileManager.save(data: data, fileExtension: "pdf") {
                        print("\(LOG_TAG) PDF saved to \(uri)")
                        let fileURL = URL(fileURLWithPath: uri)
                        events.append(AixInputWrapperOnPasteEvent(
                            type: "file",
                            filePath: uri,
                            fileExtension: "pdf",
                            fileName: fileURL.lastPathComponent
                        ))
                    }
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.svg.identifier) {
                group.enter()
                provider.loadDataRepresentation(forTypeIdentifier: UTType.svg.identifier) { data, _ in
                    defer { group.leave() }
                    guard let data else { return }
                    if let uri = try? PasteFileManager.save(data: data, fileExtension: "svg") {
                        print("\(LOG_TAG) SVG saved to \(uri)")
                        let fileURL = URL(fileURLWithPath: uri)
                        events.append(AixInputWrapperOnPasteEvent(
                            type: "file",
                            filePath: uri,
                            fileExtension: "svg",
                            fileName: fileURL.lastPathComponent
                        ))
                    }
                }
            } else if provider.canLoadObject(ofClass: UIImage.self) {
                group.enter()
                provider.loadObject(ofClass: UIImage.self) { object, _ in
                    defer { group.leave() }
                    guard let image = object as? UIImage else { return }
                    if let uri = try? PasteFileManager.save(image: image) {
                        print("\(LOG_TAG) Image saved to \(uri)")
                        let fileURL = URL(fileURLWithPath: uri)
                        events.append(AixInputWrapperOnPasteEvent(
                            type: "image",
                            filePath: uri,
                            fileExtension: fileURL.pathExtension,
                            fileName: fileURL.lastPathComponent
                        ))
                    }
                }
            }
        }

        group.notify(queue: .main) {
            completion(events)
        }
    }
}

// MARK: - Paste Handler Delegate
final class PasteHandlerDelegate: NSObject, UITextPasteDelegate {
    weak var owner: HybridAixInputWrapper?

    init(owner: HybridAixInputWrapper) {
        self.owner = owner
        super.init()
    }

    func textPasteConfigurationSupporting(_ textPasteConfigurationSupporting: UITextPasteConfigurationSupporting, transform item: UITextPasteItem) {
        guard let owner else {
            item.setDefaultResult()
            return
        }

        let pb = UIPasteboard.general
        let provider = item.itemProvider

        // Multiple images on pasteboard
        if let images = pb.images, images.count > 1 {
            print("\(LOG_TAG) Paste delegate: \(images.count) images")
            owner.saveImages(images) { events in
                if !events.isEmpty {
                    owner.onPaste?(events)
                }
                item.setNoResult()
            }
            return
        }

        // File types (PDF, SVG)
        if provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) ||
           provider.hasItemConformingToTypeIdentifier(UTType.svg.identifier) {
            owner.checkForFiles(itemProviders: [provider]) { events in
                if !events.isEmpty {
                    owner.onPaste?(events)
                    item.setNoResult()
                } else {
                    item.setDefaultResult()
                }
            }
            return
        }

        // Single image
        if let image = pb.image {
            owner.saveImages([image]) { events in
                if !events.isEmpty {
                    owner.onPaste?(events)
                }
                item.setNoResult()
            }
            return
        }

        // URL (try to fetch image)
        if let url = pb.url {
            Task {
                if let image = await owner.fetchImage(from: url) {
                    owner.saveImages([image]) { events in
                        if !events.isEmpty {
                            owner.onPaste?(events)
                        }
                        item.setNoResult()
                    }
                } else {
                    item.setDefaultResult()
                }
            }
            return
        }

        // String URL
        if let string = pb.string, let url = URL(string: string), url.scheme != nil {
            Task {
                if let image = await owner.fetchImage(from: url) {
                    owner.saveImages([image]) { events in
                        if !events.isEmpty {
                            owner.onPaste?(events)
                        }
                        item.setNoResult()
                    }
                } else {
                    item.setDefaultResult()
                }
            }
            return
        }

        // Large text
        if let text = pb.string {
            let lineCount = text.split(separator: "\n", omittingEmptySubsequences: false).count
            let charCount = text.count
            let maxCharsPropInt = owner.maxChars.map { Int($0) }
            let maxLinesPropInt = owner.maxLines.map { Int($0) }
            if let maxCharsVal = maxCharsPropInt, let maxLinesVal = maxLinesPropInt,
               lineCount > maxLinesVal || charCount > maxCharsVal {
                if let uri = try? PasteFileManager.save(text: text) {
                    let fileURL = URL(fileURLWithPath: uri)
                    owner.onPaste?([AixInputWrapperOnPasteEvent(
                        type: "text",
                        filePath: uri,
                        fileExtension: "txt",
                        fileName: fileURL.lastPathComponent
                    )])
                    item.setNoResult()
                    return
                }
            }
        }

        item.setDefaultResult()
    }
}

// MARK: - Image Drop Delegate
final class ImageDropDelegate: NSObject, UIDropInteractionDelegate {
    var onImage: ((UIImage) -> Void)?

    func dropInteraction(_ interaction: UIDropInteraction, canHandle session: UIDropSession) -> Bool {
        return session.items.contains { $0.itemProvider.canLoadObject(ofClass: UIImage.self) }
    }

    func dropInteraction(_ interaction: UIDropInteraction, sessionDidUpdate session: UIDropSession) -> UIDropProposal {
        return UIDropProposal(operation: .copy)
    }

    func dropInteraction(_ interaction: UIDropInteraction, performDrop session: UIDropSession) {
        for item in session.items {
            let provider = item.itemProvider
            if provider.canLoadObject(ofClass: UIImage.self) {
                provider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
                    guard let image = object as? UIImage else { return }
                    DispatchQueue.main.async {
                        self?.onImage?(image)
                    }
                }
            }
        }
    }
}
