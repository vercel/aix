import UIKit
import MarkdownParser
import MarkdownView

class AssistantMessageCell: UICollectionViewCell {

    static let reuseIdentifier = "AssistantMessageCell"

    static let parser = MarkdownParser()

    private static let darkTheme: MarkdownTheme = {
        var theme = MarkdownTheme()
        theme.colors.body = .white
        theme.colors.codeBackground = UIColor(white: 0.15, alpha: 1)
        return theme
    }()

    private static let sizingMarkdownView: MarkdownTextView = {
        let view = MarkdownTextView()
        view.theme = darkTheme
        return view
    }()

    private let markdownTextView: MarkdownTextView = {
        let view = MarkdownTextView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        markdownTextView.theme = Self.darkTheme
        contentView.addSubview(markdownTextView)

        NSLayoutConstraint.activate([
            markdownTextView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            markdownTextView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            markdownTextView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            markdownTextView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
        ])
    }

    func configure(with message: ChatMessage) {
        let result = Self.parser.parse(message.text)
        let content = MarkdownTextView.PreprocessedContent(parserResult: result, theme: Self.darkTheme)
        markdownTextView.setMarkdown(content)
    }

    static func height(for message: ChatMessage, constrainedToWidth width: CGFloat) -> CGFloat {
        let availableWidth = width - 32
        let result = parser.parse(message.text)
        let content = MarkdownTextView.PreprocessedContent(parserResult: result, theme: darkTheme)
        sizingMarkdownView.setMarkdownManually(content)
        let textSize = sizingMarkdownView.boundingSize(for: availableWidth)
        return 4 + textSize.height + 4
    }
}
