import '@azure/core-asynciterator-polyfill'
import { apple } from '@react-native-ai/apple'
import { streamText } from 'ai'
import { useRef, useState } from 'react'

export type UIMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function useAppleChat({
  setMessages,
  messages,
}: {
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  messages: UIMessage[]
}) {
  const controller = useRef(new AbortController())

  return {
    send: async (message: string) => {
      if (!apple.isAvailable()) {
        setMessages(previous => [
          ...previous,
          { role: 'user', content: message },
          {
            role: 'assistant',
            content:
              'Apple Foundation Models are unavailable on this device. Install on a supported iOS version to stream responses.',
          },
        ])
        return
      }

      controller.current.abort()
      controller.current = new AbortController()

      const assistantMessageIndex = messages.length + 1

      setMessages(previous => [
        ...previous,
        { role: 'user', content: message },
        { role: 'assistant', content: 'Thinking...' },
      ])

      const stream = streamText({
        model: apple(),
        messages: [
          ...messages,
          {
            role: 'user',
            content: message,
          },
        ],
        abortSignal: controller.current.signal,
      })

      let content = ''
      for await (const chunk of stream.textStream) {
        setMessages(previous => {
          const next = [...previous]
          next[assistantMessageIndex] = {
            role: 'assistant',
            content: (content += chunk),
          }
          return next
        })
      }
    },
  }
}

const defaultMessages: UIMessage[] = [
  {
    role: 'user',
    content: 'Can you show me a simple animation example?',
  },
  {
    role: 'assistant',
    content:
      'A basic pattern is to animate opacity from 0 to 1 when a component mounts. Keep duration short for chat UIs.',
  },
]

export function useMessages() {
  let [messages, setMessages] = useState<UIMessage[]>(defaultMessages)

  if (messages.at(-1)?.role === 'user') {
    messages = [...messages, { role: 'assistant', content: 'Thinking...' }]
  }

  return {
    messages,
    setMessages,
  }
}
