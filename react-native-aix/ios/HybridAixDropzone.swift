import Foundation
import UIKit

class HybridAixDropzone: HybridAixDropzoneSpec {
    var onDrop: ((_ events: [AixInputWrapperOnPasteEvent]) -> Void)?

    private let dropDelegate = DropzoneDelegate()

    // MARK: - Inner View
    private final class InnerView: UIView {
        weak var owner: HybridAixDropzone?

        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
            return false
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            owner?.setupDropInteraction()
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

    private var didSetup = false

    private func setupDropInteraction() {
        guard !didSetup, view.window != nil else { return }
        didSetup = true

        dropDelegate.onImages = { [weak self] images in
            self?.handleDroppedImages(images)
        }

        // Add drop interaction to the Fabric container (superview) so it covers the full area
        let target = view.superview ?? view
        target.addInteraction(UIDropInteraction(delegate: dropDelegate))
    }

    // MARK: - Drop Handling
    private func handleDroppedImages(_ images: [UIImage]) {
        var events: [AixInputWrapperOnPasteEvent] = []
        for image in images {
            if let uri = try? PasteFileManager.save(image: image) {
                let fileURL = URL(fileURLWithPath: uri)
                events.append(AixInputWrapperOnPasteEvent(
                    type: "image",
                    filePath: uri,
                    fileExtension: fileURL.pathExtension,
                    fileName: fileURL.lastPathComponent
                ))
            }
        }
        if !events.isEmpty {
            onDrop?(events)
        }
    }
}

// MARK: - Drop Delegate
private final class DropzoneDelegate: NSObject, UIDropInteractionDelegate {
    var onImages: (([UIImage]) -> Void)?

    func dropInteraction(_ interaction: UIDropInteraction, canHandle session: UIDropSession) -> Bool {
        return session.items.contains { $0.itemProvider.canLoadObject(ofClass: UIImage.self) }
    }

    func dropInteraction(_ interaction: UIDropInteraction, sessionDidUpdate session: UIDropSession) -> UIDropProposal {
        return UIDropProposal(operation: .copy)
    }

    func dropInteraction(_ interaction: UIDropInteraction, performDrop session: UIDropSession) {
        let providers = session.items.map { $0.itemProvider }
        var images: [UIImage] = []
        let group = DispatchGroup()

        for provider in providers {
            guard provider.canLoadObject(ofClass: UIImage.self) else { continue }
            group.enter()
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                defer { group.leave() }
                guard let image = object as? UIImage else { return }
                images.append(image)
            }
        }

        group.notify(queue: .main) { [weak self] in
            if !images.isEmpty {
                self?.onImages?(images)
            }
        }
    }
}
