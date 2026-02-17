import {
  ComposerHeightContextProvider,
  MessageListContextProvider,
  ChatAnimationProvider,
  KeyboardStateProvider,
} from 'ai-chat'

export function ChatProvider({
  chatId,
  children,
}: {
  chatId: string
  children: React.ReactNode
}) {
  return (
    <ComposerHeightContextProvider initialHeight={0}>
      <MessageListContextProvider key={chatId}>
        <ChatAnimationProvider>
          <KeyboardStateProvider>{children}</KeyboardStateProvider>
        </ChatAnimationProvider>
      </MessageListContextProvider>
    </ComposerHeightContextProvider>
  )
}
