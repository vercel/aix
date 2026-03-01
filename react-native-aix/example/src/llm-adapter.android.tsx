import { useCallback, useState } from 'react';

type UIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const defaultMessages: UIMessage[] = [
  {
    role: 'assistant',
    content: 'Hi! Apple Intelligence is not available on Android, but this chat simulates an LLM response.',
  },
];

function createSimulatedResponse(prompt: string) {
  return [
    'Here is a simulated Android response.',
    '',
    `You asked: "${prompt}"`,
    '',
    'This fallback intentionally mimics an LLM by showing a short thinking state before answering.',
  ].join('\n');
}

export function useLlmMessages() {
  const [messages, setMessages] = useState<UIMessage[]>(defaultMessages);
  return { messages, setMessages };
}

export function useLlmAdapter({ setMessages }: { setMessages: (fn: (messages: UIMessage[]) => UIMessage[]) => void; messages: UIMessage[]; }) {
  const send = useCallback((message: string) => {
    let assistantMessageIndex = -1;

    setMessages((prev) => {
      assistantMessageIndex = prev.length + 1;
      return [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: 'Thinking...' },
      ];
    });

    setTimeout(() => {
      const response = createSimulatedResponse(message);

      setMessages((prev) => {
        if (assistantMessageIndex < 0 || assistantMessageIndex >= prev.length) {
          return [...prev, { role: 'assistant', content: response }];
        }

        const next = [...prev];
        next[assistantMessageIndex] = { role: 'assistant', content: response };
        return next;
      });
    }, 900);
  }, [setMessages]);

  return { send };
}