import {
  ComposerHeightContextProvider,
  MessageListContextProvider,
  ChatAnimationProvider,
  KeyboardStateProvider,
} from 'ai-chat'
import { KeyboardProvider } from 'react-native-keyboard-controller'

export function ListProvider({
  children,
  initialComposerHeight = 0,
}: {
  children: React.ReactNode
  initialComposerHeight?: number
}) {
  return (
    <KeyboardProvider>
      <ComposerHeightContextProvider initialHeight={initialComposerHeight}>
        <MessageListContextProvider>
          <ChatAnimationProvider>
            <KeyboardStateProvider>{children}</KeyboardStateProvider>
          </ChatAnimationProvider>
        </MessageListContextProvider>
      </ComposerHeightContextProvider>
    </KeyboardProvider>
  )
}
