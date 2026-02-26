import UIKit

class LoadingIndicatorCell: UICollectionViewCell {

    static let reuseIdentifier = "LoadingIndicatorCell"

    private let label: UILabel = {
        let label = UILabel()
        label.text = "Thinking..."
        label.textColor = UIColor(white: 0.5, alpha: 1)
        label.font = .systemFont(ofSize: 17)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        contentView.addSubview(label)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            label.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            label.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
        ])
    }

    func startAnimating() {
        // TODO: Add shimmer
    }

    func stopAnimating() {
        // TODO: Add shimmer
    }

    func configure(text: String) {
        label.text = text
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        label.text = "Thinking..."
    }
}
