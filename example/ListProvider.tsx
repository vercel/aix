import {
  ComposerHeightContextProvider,
  MessageListContextProvider,
  ChatAnimationProvider,
  KeyboardStateProvider,
} from 'ai-chat'
import { KeyboardProvider } from 'react-native-keyboard-controller'

export function ChatProvider({
  chatId,
  children,
}: {
  chatId: string
  children: React.ReactNode
}) {
  return (
    <KeyboardProvider>
      <ComposerHeightContextProvider initialHeight={0}>
        <MessageListContextProvider key={chatId}>
          <ChatAnimationProvider>
            <KeyboardStateProvider>{children}</KeyboardStateProvider>
          </ChatAnimationProvider>
        </MessageListContextProvider>
      </ComposerHeightContextProvider>
    </KeyboardProvider>
  )
}
