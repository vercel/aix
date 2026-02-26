import UIKit
import UITextView_Placeholder

protocol ChatInputBarDelegate: AnyObject {
    func chatInputBar(_ inputBar: ChatInputBar, didSendMessage text: String)
}

class ChatInputBar: UIView {

    weak var delegate: ChatInputBarDelegate?

    // MARK: - Subviews

    private let plusButton: UIButton = {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
        button.setImage(UIImage(systemName: "plus", withConfiguration: config), for: .normal)
        button.tintColor = .white
        button.backgroundColor = UIColor(white: 0.2, alpha: 1)
        button.clipsToBounds = true
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    private let textContainerView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(white: 0.15, alpha: 1)
        view.layer.cornerRadius = 22
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    let textView: UITextView = {
        let tv = UITextView()
        tv.backgroundColor = .clear
        tv.font = .systemFont(ofSize: 16)
        tv.textColor = .white
        tv.tintColor = .white
        tv.isScrollEnabled = false
        tv.textContainerInset = UIEdgeInsets(top: 12, left: 4, bottom: 12, right: 4)
        tv.placeholder = "Ask anything"
        tv.placeholderColor = UIColor(white: 0.5, alpha: 1)
        tv.translatesAutoresizingMaskIntoConstraints = false
        return tv
    }()

    private let micButton: UIButton = {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
        button.setImage(UIImage(systemName: "mic", withConfiguration: config), for: .normal)
        button.tintColor = UIColor(white: 0.5, alpha: 1)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    private let sendButton: UIButton = {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
        button.setImage(UIImage(systemName: "arrow.up", withConfiguration: config), for: .normal)
        button.tintColor = .black
        button.backgroundColor = .white
        button.layer.cornerRadius = 16
        button.translatesAutoresizingMaskIntoConstraints = false
        button.isHidden = true
        return button
    }()

    private var textViewHeightConstraint: NSLayoutConstraint!
    private let maxTextViewHeight: CGFloat = 120

    // MARK: - Init

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupViews()
    }

    // MARK: - Setup

    private func setupViews() {
        backgroundColor = .clear
        translatesAutoresizingMaskIntoConstraints = false

        addSubview(plusButton)
        addSubview(textContainerView)
        textContainerView.addSubview(textView)
        textContainerView.addSubview(micButton)
        textContainerView.addSubview(sendButton)

        textViewHeightConstraint = textView.heightAnchor.constraint(equalToConstant: 44)
        textViewHeightConstraint.priority = .defaultLow

        NSLayoutConstraint.activate([
            // Plus button — left side, 1:1 aspect, matches text container height
            plusButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            plusButton.centerYAnchor.constraint(equalTo: textContainerView.centerYAnchor),
            plusButton.heightAnchor.constraint(equalTo: textContainerView.heightAnchor),
            plusButton.widthAnchor.constraint(equalTo: plusButton.heightAnchor),

            // Text container — right of plus button
            textContainerView.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            textContainerView.leadingAnchor.constraint(equalTo: plusButton.trailingAnchor, constant: 8),
            textContainerView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            textContainerView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),

            // Text view — inside container, left of mic/send
            textView.topAnchor.constraint(equalTo: textContainerView.topAnchor),
            textView.leadingAnchor.constraint(equalTo: textContainerView.leadingAnchor, constant: 4),
            textView.trailingAnchor.constraint(equalTo: micButton.leadingAnchor, constant: -4),
            textView.bottomAnchor.constraint(equalTo: textContainerView.bottomAnchor),
            textViewHeightConstraint,
            textView.heightAnchor.constraint(lessThanOrEqualToConstant: maxTextViewHeight),

            // Mic button — inside container, right side
            micButton.trailingAnchor.constraint(equalTo: textContainerView.trailingAnchor, constant: -12),
            micButton.centerYAnchor.constraint(equalTo: textContainerView.centerYAnchor),
            micButton.widthAnchor.constraint(equalToConstant: 24),
            micButton.heightAnchor.constraint(equalToConstant: 24),

            // Send button — overlaps mic position
            sendButton.trailingAnchor.constraint(equalTo: textContainerView.trailingAnchor, constant: -6),
            sendButton.bottomAnchor.constraint(equalTo: textContainerView.bottomAnchor, constant: -6),
            sendButton.widthAnchor.constraint(equalToConstant: 32),
            sendButton.heightAnchor.constraint(equalToConstant: 32),
        ])

        textView.delegate = self
        sendButton.addTarget(self, action: #selector(sendTapped), for: .touchUpInside)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        plusButton.layer.cornerRadius = plusButton.bounds.height / 2
    }

    // MARK: - Actions

    @objc private func sendTapped() {
        guard let text = textView.text?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else { return }
        delegate?.chatInputBar(self, didSendMessage: text)
        textView.text = ""
        updateButtonVisibility()
        updateTextViewHeight()
    }

    // MARK: - State

    private func updateButtonVisibility() {
        let hasText = !(textView.text?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        sendButton.isHidden = !hasText
        micButton.isHidden = hasText
    }

    private func updateTextViewHeight() {
        let size = textView.sizeThatFits(CGSize(width: textView.bounds.width, height: .greatestFiniteMagnitude))
        let newHeight = min(size.height, maxTextViewHeight)
        textView.isScrollEnabled = size.height > maxTextViewHeight
        textViewHeightConstraint.constant = newHeight
    }
}

// MARK: - UITextViewDelegate

extension ChatInputBar: UITextViewDelegate {
    func textViewDidChange(_ textView: UITextView) {
        updateButtonVisibility()
        updateTextViewHeight()
    }
}
