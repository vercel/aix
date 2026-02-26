import UIKit
import os.log

private let log = Logger(subsystem: "AixExample", category: "ChatViewController")

class ChatViewController: UIViewController {
    
    private let chatService = ChatService()
    private var messages: [ChatMessage] = []
    
    // MARK: - Spring Animation Parameters
    
    private let springDuration: CGFloat = 0.75
    private let springDamping: CGFloat = 0.85
    private let springVelocity: CGFloat = 2.0
    
    // MARK: - Height Cache
    
    private var heightCache: [UUID: (textHash: Int, width: CGFloat, height: CGFloat)] = [:]
    
    // MARK: - Views
    
    private lazy var sizingUserCell = UserMessageCell(frame: .zero)
    
    private lazy var chatLayout: ChatCollectionViewLayout = {
        let layout = ChatCollectionViewLayout()
        layout.dataProvider = self
        return layout
    }()
    
    private lazy var collectionView: UICollectionView = {
        let cv = UICollectionView(frame: .zero, collectionViewLayout: chatLayout)
        cv.backgroundColor = .black
        cv.contentInsetAdjustmentBehavior = .never
        cv.automaticallyAdjustsScrollIndicatorInsets = false
        cv.keyboardDismissMode = .interactive
        cv.alwaysBounceVertical = true
        cv.register(UserMessageCell.self, forCellWithReuseIdentifier: UserMessageCell.reuseIdentifier)
        cv.register(AssistantMessageCell.self, forCellWithReuseIdentifier: AssistantMessageCell.reuseIdentifier)
        cv.register(LoadingIndicatorCell.self, forCellWithReuseIdentifier: LoadingIndicatorCell.reuseIdentifier)
        return cv
    }()
    
    private lazy var dataSource: UICollectionViewDiffableDataSource<Int, ChatMessage> = {
        UICollectionViewDiffableDataSource<Int, ChatMessage>(collectionView: collectionView) { [weak self] collectionView, indexPath, _ in
            guard let self else { return UICollectionViewCell() }
            let current = self.messages[indexPath.item]
            switch current.role {
            case .user:
                let cell = collectionView.dequeueReusableCell(withReuseIdentifier: UserMessageCell.reuseIdentifier, for: indexPath) as! UserMessageCell
                cell.configure(with: current)
                return cell
            case .assistant:
                let cell = collectionView.dequeueReusableCell(withReuseIdentifier: AssistantMessageCell.reuseIdentifier, for: indexPath) as! AssistantMessageCell
                cell.configure(with: current)
                return cell
            case .loadingIndicator:
                let cell = collectionView.dequeueReusableCell(
                    withReuseIdentifier: LoadingIndicatorCell.reuseIdentifier, for: indexPath
                ) as! LoadingIndicatorCell
                cell.startAnimating()
                return cell
            }
        }
    }()
    
    private let inputBar = ChatInputBar()
    
    private var inputBarBottomConstraint: NSLayoutConstraint!
    private var inputBarKeyboardConstraint: NSLayoutConstraint!
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupNavigationBar()
        setupCollectionView()
        setupInputBar()
        applySnapshot(animated: false)
        log.info("viewDidLoad complete")
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateCollectionViewInsets()
    }
    
    // MARK: - Navigation Bar
    
    private func setupNavigationBar() {
        title = ""
        navigationController?.navigationBar.prefersLargeTitles = false
        
        let appearance = UINavigationBarAppearance()
        appearance.configureWithTransparentBackground()
        navigationController?.navigationBar.standardAppearance = appearance
        navigationController?.navigationBar.scrollEdgeAppearance = appearance
        
        let menuButton = UIBarButtonItem(
            image: UIImage(systemName: "line.3.horizontal"),
            style: .plain, target: nil, action: nil
        )
        menuButton.tintColor = .white
        navigationItem.leftBarButtonItem = menuButton
        
        let composeButton = UIBarButtonItem(
            image: UIImage(systemName: "square.and.pencil"),
            style: .plain, target: self, action: #selector(composeTapped)
        )
        composeButton.tintColor = .white
        navigationItem.rightBarButtonItem = composeButton
    }
    
    @objc private func composeTapped() {
        messages.removeAll()
        heightCache.removeAll()
        applySnapshot(animated: false)
        inputBar.textView.becomeFirstResponder()
    }
    
    // MARK: - Setup
    
    private func setupCollectionView() {
        view.addSubview(collectionView)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }
    
    private func setupInputBar() {
        view.addSubview(inputBar)
        inputBar.delegate = self
        inputBar.translatesAutoresizingMaskIntoConstraints = false
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.inputBar.textView.becomeFirstResponder()
        }
        
        if #available(iOS 26.0, *) {
            let edgeInteraction = UIScrollEdgeElementContainerInteraction()
            edgeInteraction.scrollView = collectionView
            edgeInteraction.edge = .bottom
            inputBar.addInteraction(edgeInteraction)
        }
        
        inputBarBottomConstraint = inputBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        inputBarBottomConstraint.priority = .defaultHigh
    
        // So nice
        inputBarKeyboardConstraint = inputBar.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        inputBarKeyboardConstraint.priority = .required
        
        NSLayoutConstraint.activate([
            inputBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            inputBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            inputBarBottomConstraint,
            inputBarKeyboardConstraint,
        ])
    }
    
    // MARK: - Insets
    
    private var lastBottomInset: CGFloat = 0
    
    // Adjust scroll view insets / indicator insets
    private func updateCollectionViewInsets() {
        let inputBarTop = inputBar.frame.minY
        let bottomInset = view.bounds.height - inputBarTop
        let topInset = view.safeAreaInsets.top
        
        guard bottomInset != lastBottomInset || topInset != collectionView.contentInset.top else { return }
        
        let oldBottomInset = lastBottomInset
        lastBottomInset = bottomInset
        
        collectionView.contentInset = UIEdgeInsets(top: topInset, left: 0, bottom: bottomInset, right: 0)
        collectionView.verticalScrollIndicatorInsets = UIEdgeInsets(top: topInset, left: 0, bottom: bottomInset, right: 0)
        
        if bottomInset != oldBottomInset {
            collectionView.collectionViewLayout.invalidateLayout()
        }
    }
    
    // MARK: - Diffable Data Source
    
    private func applySnapshot(animated: Bool) {
        var snapshot = NSDiffableDataSourceSnapshot<Int, ChatMessage>()
        snapshot.appendSections([0])
        snapshot.appendItems(messages)
        dataSource.apply(snapshot, animatingDifferences: animated)
    }
    
    private func reconfigureLastMessage() {
        guard let lastMessage = messages.last else { return }
        var snapshot = NSDiffableDataSourceSnapshot<Int, ChatMessage>()
        snapshot.appendSections([0])
        snapshot.appendItems(messages)
        snapshot.reconfigureItems([lastMessage])
        dataSource.apply(snapshot, animatingDifferences: false)
    }
    
    // MARK: - Send Message (Coordinated Animation)
    
    private func sendMessage(_ text: String) {
        log.info("sendMessage: \"\(text)\"")
        let userMessage = ChatMessage(role: .user, text: text)
        let userIndex = messages.count
        messages.append(userMessage)

        view.endEditing(true)
        
        let layout = collectionView.collectionViewLayout as! ChatCollectionViewLayout
        
        // Pre scroll if user message is sent and content offset isn't bottom
        let estimatedTargetY = estimatedContentOffsetY(beforeItemAt: userIndex, in: collectionView, layout: layout)
        preScrollIfNeeded(toward: estimatedTargetY, in: collectionView)
        
        var snapshot = NSDiffableDataSourceSnapshot<Int, ChatMessage>()
        snapshot.appendSections([0])
        snapshot.appendItems(messages)

        let userIndexPath = IndexPath(item: userIndex, section: 0)
        let startTime = CACurrentMediaTime()
        let animationDuration = springDuration

        UIView.animate(
            withDuration: springDuration,
            delay: 0,
            usingSpringWithDamping: springDamping,
            initialSpringVelocity: springVelocity,
            options: [.allowUserInteraction]
        ) {
            self.dataSource.apply(snapshot, animatingDifferences: true)
            // animate to the index path of the user message
            self.collectionView.scrollToItem(at: userIndexPath, at: .top, animated: false)
        } completion: { [weak self] _ in
            guard let self else { return }
            let elapsed = CACurrentMediaTime() - startTime
            let remaining = max(0, animationDuration - elapsed)
            // Weird timing issue with first mesage
            if remaining > 0.05 {
                DispatchQueue.main.asyncAfter(deadline: .now() + remaining) {
                    self.streamAIResponse(text: text)
                }
            } else {
                self.streamAIResponse(text: text)
            }
        }
    }
    
    private func estimatedContentOffsetY(beforeItemAt index: Int, in collectionView: UICollectionView, layout: ChatCollectionViewLayout) -> CGFloat {
        guard index > 0 else { return 0 }
        var y: CGFloat = 0
        let width = collectionView.bounds.width
        for i in 0..<index {
            let ip = IndexPath(item: i, section: 0)
            let h = self.chatLayout(layout, heightForItemAt: ip, constrainedToWidth: width)
            y += h + layout.interItemSpacing
        }
        return y
    }
    
    private func preScrollIfNeeded(toward targetY: CGFloat, in collectionView: UICollectionView) {
        let scrollDistance = abs(targetY - collectionView.contentOffset.y)
        guard scrollDistance > collectionView.bounds.height else { return }
        let preScrollY = max(0, targetY - collectionView.bounds.height * 0.8)
        collectionView.contentOffset = CGPoint(x: 0, y: preScrollY)
        collectionView.layoutIfNeeded()
    }
    
    
    // MARK: - Stream AI Response
    
    private func streamAIResponse(text: String) {
        log.info("streamAIResponse: starting for \"\(text)\"")
        
        Task { @MainActor in
            do {
                // Show typing indicator
                let typingMessage = ChatMessage(role: .loadingIndicator, text: "")
                messages.append(typingMessage)
                applySnapshot(animated: false)

                let stream = chatService.streamResponse(to: text)
                var firstChunk = true
                for try await fullText in stream {
                    if firstChunk {
                        // Replace typing indicator with assistant message
                        let typingIndex = messages.count - 1
                        messages[typingIndex] = ChatMessage(role: .assistant, text: fullText, status: .streaming)
                        applySnapshot(animated: false)
                        firstChunk = false
                    } else {
                        let assistantIndex = messages.count - 1
                        messages[assistantIndex].text = fullText
                        reconfigureLastMessage()
                    }
                }
                
                let assistantIndex = messages.count - 1
                messages[assistantIndex].status = .complete
                reconfigureLastMessage()
                log.info("streamAIResponse: complete, length=\(self.messages[assistantIndex].text.count)")
                
            } catch {
                log.error("streamAIResponse: error: \(error.localizedDescription)")
                
                if let last = messages.last, last.role == .loadingIndicator {
                    // Replace typing indicator with error message
                    let idx = messages.count - 1
                    messages[idx] = ChatMessage(
                        role: .assistant,
                        text: "Sorry, something went wrong: \(error.localizedDescription)",
                        status: .complete
                    )
                } else if let last = messages.last, last.role == .assistant {
                    let idx = messages.count - 1
                    messages[idx].status = .complete
                    if messages[idx].text.isEmpty {
                        messages[idx].text = "Sorry, something went wrong: \(error.localizedDescription)"
                    }
                } else {
                    messages.append(ChatMessage(
                        role: .assistant,
                        text: "Sorry, something went wrong: \(error.localizedDescription)",
                        status: .complete
                    ))
                }
                applySnapshot(animated: false)
            }
        }
    }
}

// MARK: - ChatLayoutDataProvider

extension ChatViewController: ChatLayoutDataProvider {
    func chatLayout(_ layout: ChatCollectionViewLayout, messageRoleAt indexPath: IndexPath) -> MessageRole {
        messages[indexPath.item].role
    }
    
    func chatLayout(_ layout: ChatCollectionViewLayout, heightForItemAt indexPath: IndexPath, constrainedToWidth width: CGFloat) -> CGFloat {
        let message = messages[indexPath.item]
        
        let textHash = message.text.hashValue
        if let cached = heightCache[message.id],
           cached.textHash == textHash,
           cached.width == width {
            return cached.height
        }
        
        let height: CGFloat
        switch message.role {
        case .user:
            sizingUserCell.frame.size.width = width
            sizingUserCell.configure(with: message)
            let targetSize = CGSize(width: width, height: UIView.layoutFittingCompressedSize.height)
            height = sizingUserCell.contentView.systemLayoutSizeFitting(
                targetSize,
                withHorizontalFittingPriority: .required,
                verticalFittingPriority: .fittingSizeLevel
            ).height
        case .assistant:
            height = AssistantMessageCell.height(for: message, constrainedToWidth: width)
        case .loadingIndicator:
            height = 33 // 8pt top + 17pt label + 8pt bottom
        }
        
        heightCache[message.id] = (textHash: textHash, width: width, height: height)
        return height
    }
}

// MARK: - ChatInputBarDelegate

extension ChatViewController: ChatInputBarDelegate {
    func chatInputBar(_ inputBar: ChatInputBar, didSendMessage text: String) {
        sendMessage(text)
    }
}
