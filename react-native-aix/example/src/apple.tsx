import { apple,  } from '@react-native-ai/apple';
import { streamText } from 'ai';
import { useState } from 'react';
import '@azure/core-asynciterator-polyfill'

type UIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function useAppleChat({
  setMessages,
  messages,
}: {
  setMessages: (fn: (messages: UIMessage[]) => UIMessage[]) => void;
  messages: UIMessage[];
}) {
  return {
    send: async function (message: string) {
      const assistantMessageIndex = messages.length + 1;
      setMessages(messages => [
        ...messages,
        { role: 'user', content: message },
        {
          role: 'assistant',
          content: 'Thinking...',
        }
      ]);

      const stream = streamText({
        model: apple(),
        messages: [
          ...messages,
          {
            role: 'user',
            content: message,
          },
        ],
      });

      let content = '';
      for await (const chunk of stream.textStream) {
        setMessages(messages => {
          const newMessages = [...messages];
          newMessages[assistantMessageIndex] = {
            role: 'assistant',
            content: (content += chunk),
          };
          return newMessages;
        });
      }
    },
  };
}

export function useMessages() {
  let [messages, setMessages] = useState<UIMessage[]>([]);

  if (messages.at(-1)?.role === 'user') {
    // optimistic system message
    messages = [...messages, { role: 'assistant', content: 'Thinking...' }];
  }

  return {
    messages,
    setMessages,
  };
}
