import { streamText } from 'ai'
import { apple, AppleFoundationModels } from '@react-native-ai/apple'
import { useState, useTransition } from 'react'

export function useAppleChat() {
  const [isPending, startTransition] = useTransition()
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([])

  return {
    isPending,
    messages,
    submit: (prompt: string) => {
      const newMessages = [
        ...messages,
        { role: 'user', content: prompt },
      ] satisfies typeof messages
      setMessages(newMessages)
      const assistantMessageIdx = newMessages.length

      if (!AppleFoundationModels.isAvailable()) {
        return alert('Apple Foundation Models are not available on this device')
      }

      startTransition(async () => {
        const { textStream } = streamText({
          model: apple(),
          prompt,
        })

        let content = ''
        for await (const delta of textStream) {
          console.log(delta)
          content += delta
          setMessages((prev) => {
            const newMessages = [...prev]
            newMessages[assistantMessageIdx] = {
              role: 'assistant',
              content,
            }
            return newMessages
          })
        }
      })
    },
  }
}
