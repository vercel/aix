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
      "Here's a simple fade-in animation using Reanimated:\n\n```tsx\nimport Animated, { \n  useSharedValue, \n  useAnimatedStyle, \n  withTiming \n} from 'react-native-reanimated';\n\nfunction FadeInView({ children }) {\n  const opacity = useSharedValue(0);\n  \n  useEffect(() => {\n    opacity.value = withTiming(1, { duration: 500 });\n  }, []);\n  \n  const animatedStyle = useAnimatedStyle(() => ({\n    opacity: opacity.value,\n  }));\n  \n  return (\n    <Animated.View style={animatedStyle}>\n      {children}\n    </Animated.View>\n  );\n}\n```\n\nThis creates a smooth fade-in effect when the component mounts. You can customize the duration and add easing functions for different effects!",
  },
  {
    role: 'user',
    content:
      'Perfect, thanks for all the help! One last question - what are your thoughts on Expo vs bare React Native?',
  },
  {
    role: 'assistant',
    content:
      "This is one of the most common questions in the React Native community! Here's my take:\n\n**Choose Expo if:**\n- You're starting a new project and want to move fast\n- You don't need highly custom native code\n- You want easy OTA updates and a managed build service\n- Your team is primarily JavaScript/TypeScript focused\n- You want to use Expo Router for file-based navigation\n\n**Choose Bare React Native if:**\n- You need deep native customization from day one\n- You're integrating with existing native codebases\n- You have specific native SDK requirements that aren't in Expo\n\n**The good news:** The line has blurred significantly! With Expo's \"prebuild\" system and config plugins, you can now eject native code when needed while still using Expo's tooling. Most teams today start with Expo and only add custom native code when necessary. It's no longer an either/or decision - you can have the best of both worlds!",
  },
  {
    role: 'user',
    content: 'How can I use the new TurboModules in React Native?',
  },
  {
    role: 'assistant',
    content: 'Try googling it!',
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
