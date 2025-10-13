import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { createContext, use } from 'react'
import useLatestCallback from 'use-latest-callback'
import { useDebouncedCallback } from '../../utils/useDebouncedCallback'

const ChatAnimationContext = createContext<{
  /**
   * Shared value that indicates whether the message send animation is active
   */
  isMessageSendAnimating: SharedValue<boolean>
  /**
   * Triggers/toggles the message send animation flag
   */
  setIsMessageSendAnimating: (isAnimating: boolean) => void
} | null>(null)

export function ChatAnimationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const isMessageSendAnimating = useSharedValue(false)

  // Debounced function to reset animation state after 500ms
  const resetAnimation = useDebouncedCallback(() => {
    isMessageSendAnimating.set(false)
  }, 500)

  const setIsMessageSendAnimating = useLatestCallback(
    (isAnimating: boolean) => {
      isMessageSendAnimating.set(isAnimating)
      if (isAnimating) {
        // useFirstMessageEntrance sets this to false after processing it,
        // but reset it here just in case
        resetAnimation()
      }
    }
  )

  return (
    <ChatAnimationContext.Provider
      value={{ isMessageSendAnimating, setIsMessageSendAnimating }}
    >
      {children}
    </ChatAnimationContext.Provider>
  )
}

export function useChatAnimation() {
  const ctx = use(ChatAnimationContext)

  if (!ctx) {
    throw new Error(
      'useChatAnimation must be used within a ChatAnimationProvider'
    )
  }

  return ctx
}
