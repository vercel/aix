import UIKit

protocol ChatLayoutDataProvider: AnyObject {
    func chatLayout(_ layout: ChatCollectionViewLayout, messageRoleAt indexPath: IndexPath) -> MessageRole
    func chatLayout(_ layout: ChatCollectionViewLayout, heightForItemAt indexPath: IndexPath,
                    constrainedToWidth width: CGFloat) -> CGFloat
}

class ChatCollectionViewLayout: UICollectionViewLayout {
    
    weak var dataProvider: ChatLayoutDataProvider?
    
    var interItemSpacing: CGFloat = 4
    
    private var cachedAttributes: [IndexPath: UICollectionViewLayoutAttributes] = [:]
    private var contentHeight: CGFloat = 0
    private var insertedIndexPaths: Set<IndexPath> = []
    private var previousWidth: CGFloat = 0
    
    // MARK: - Core Layout
    
    override func prepare() {
        super.prepare()
        
        guard let collectionView, let dataProvider else { return }
        
        let width = collectionView.bounds.width
        cachedAttributes.removeAll()
        contentHeight = 0
        
        guard collectionView.numberOfSections > 0 else { return }
        let itemCount = collectionView.numberOfItems(inSection: 0)
        guard itemCount > 0 else { return }
        
        var yOffset: CGFloat = 0
        
        for item in 0..<itemCount {
            let indexPath = IndexPath(item: item, section: 0)
            // This prepare function just stacks rectangles on top of each other, get the height of the item at the index path
            // Advance the yOffset by height and spacing
            let height = dataProvider.chatLayout(self, heightForItemAt: indexPath, constrainedToWidth: width)
            
            let attributes = UICollectionViewLayoutAttributes(forCellWith: indexPath)
            attributes.frame = CGRect(x: 0, y: yOffset, width: width, height: height)
            cachedAttributes[indexPath] = attributes
            
            yOffset += height + interItemSpacing
        }
        
        contentHeight = yOffset - interItemSpacing
        
        var lastUserIndex: Int? = nil
        for item in stride(from: itemCount - 1, through: 0, by: -1) {
            let indexPath = IndexPath(item: item, section: 0)
            if dataProvider.chatLayout(self, messageRoleAt: indexPath) == .user {
                lastUserIndex = item
                break
            }
        }
        
        // Find last message item and compute extra space
        if let lastUserIndex,
           let lastUserAttrs = cachedAttributes[IndexPath(item: lastUserIndex, section: 0)] {
            let contentBelowLastUser = contentHeight - lastUserAttrs.frame.minY
            let insets = collectionView.adjustedContentInset
            let visibleHeight = collectionView.bounds.height - insets.top - insets.bottom
            let bottomPadding = max(0, visibleHeight - contentBelowLastUser)
            contentHeight += bottomPadding
        }
        
        previousWidth = width
    }
    
    override var collectionViewContentSize: CGSize {
        guard let collectionView else { return .zero }
        return CGSize(width: collectionView.bounds.width, height: contentHeight)
    }
    
    override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
        cachedAttributes.values.filter { $0.frame.intersects(rect) }
    }
    
    override func layoutAttributesForItem(at indexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
        cachedAttributes[indexPath]
    }
    
    override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool {
        guard let collectionView else { return false }
        return collectionView.bounds.size != newBounds.size
    }
    
    // MARK: - Insert Animations
    
    override func prepare(forCollectionViewUpdates updateItems: [UICollectionViewUpdateItem]) {
        super.prepare(forCollectionViewUpdates: updateItems)
        insertedIndexPaths.removeAll()
        for item in updateItems {
            if item.updateAction == .insert, let indexPath = item.indexPathAfterUpdate {
                insertedIndexPaths.insert(indexPath)
            }
        }
    }
    
    override func initialLayoutAttributesForAppearingItem(at itemIndexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
        guard insertedIndexPaths.contains(itemIndexPath) else {
            return cachedAttributes[itemIndexPath]?.copy() as? UICollectionViewLayoutAttributes
        }
        
        guard let attributes = cachedAttributes[itemIndexPath]?.copy() as? UICollectionViewLayoutAttributes,
              let collectionView else {
            return super.initialLayoutAttributesForAppearingItem(at: itemIndexPath)
        }
        
        let viewportBottom = collectionView.contentOffset.y + collectionView.bounds.height
        let offscreenPadding = insertionOffscreenPadding(in: collectionView)
        let translateY = viewportBottom - attributes.frame.minY + offscreenPadding
        attributes.transform = CGAffineTransform(translationX: 0, y: translateY)
        return attributes
    }
    
    override func finalizeCollectionViewUpdates() {
        super.finalizeCollectionViewUpdates()
        insertedIndexPaths.removeAll()
    }
    
    private func insertionOffscreenPadding(in collectionView: UICollectionView) -> CGFloat {
        let base: CGFloat = 16
        return max(base, collectionView.adjustedContentInset.bottom + base)
    }
    
    // MARK: - Self-Sizing Support
    
    override func shouldInvalidateLayout(
        forPreferredLayoutAttributes preferredAttributes: UICollectionViewLayoutAttributes,
        withOriginalAttributes originalAttributes: UICollectionViewLayoutAttributes
    ) -> Bool {
        abs(preferredAttributes.frame.height - originalAttributes.frame.height) > 1
    }
    
    override func invalidationContext(
        forPreferredLayoutAttributes preferredAttributes: UICollectionViewLayoutAttributes,
        withOriginalAttributes originalAttributes: UICollectionViewLayoutAttributes
    ) -> UICollectionViewLayoutInvalidationContext {
        let context = super.invalidationContext(forPreferredLayoutAttributes: preferredAttributes,
                                                withOriginalAttributes: originalAttributes)
        return context
    }
}
