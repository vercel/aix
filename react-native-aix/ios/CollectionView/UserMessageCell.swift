import UIKit

class UserMessageCell: UICollectionViewCell {
    
    static let reuseIdentifier = "UserMessageCell"
    
    private let bubbleView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(red: 0.235, green: 0.235, blue: 0.235, alpha: 1)
        view.layer.cornerRadius = 18
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private let messageTextView: UITextView = {
        let tv = UITextView()
        tv.textColor = .white
        tv.font = .systemFont(ofSize: 16)
        tv.backgroundColor = .clear
        tv.isEditable = false
        tv.isScrollEnabled = false
        tv.isSelectable = true
        tv.textContainerInset = .zero
        tv.textContainer.lineFragmentPadding = 0
        tv.translatesAutoresizingMaskIntoConstraints = false
        return tv
    }()
    
    private var bubbleMaxWidthConstraint: NSLayoutConstraint!
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupViews() {
        contentView.addSubview(bubbleView)
        bubbleView.addSubview(messageTextView)
        
        bubbleMaxWidthConstraint = bubbleView.widthAnchor.constraint(lessThanOrEqualToConstant: 280)
        
        NSLayoutConstraint.activate([
            bubbleView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            bubbleView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
            bubbleView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            bubbleMaxWidthConstraint,
            
            messageTextView.topAnchor.constraint(equalTo: bubbleView.topAnchor, constant: 10),
            messageTextView.bottomAnchor.constraint(equalTo: bubbleView.bottomAnchor, constant: -10),
            messageTextView.leadingAnchor.constraint(equalTo: bubbleView.leadingAnchor, constant: 14),
            messageTextView.trailingAnchor.constraint(equalTo: bubbleView.trailingAnchor, constant: -14),
        ])
    }
    
    func configure(with message: ChatMessage) {
        messageTextView.text = message.text
        bubbleMaxWidthConstraint.constant = 280
    }
    
    override func preferredLayoutAttributesFitting(
        _ layoutAttributes: UICollectionViewLayoutAttributes
    ) -> UICollectionViewLayoutAttributes {
        setNeedsLayout()
        layoutIfNeeded()
        let attributes = super.preferredLayoutAttributesFitting(layoutAttributes)
        let size = contentView.systemLayoutSizeFitting(
            CGSize(width: layoutAttributes.frame.width, height: UIView.layoutFittingCompressedSize.height),
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        )
        attributes.frame.size.height = size.height
        return attributes
    }
}
