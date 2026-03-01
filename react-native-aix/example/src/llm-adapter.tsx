import { apple } from '@react-native-ai/apple';
import { streamText } from 'ai';
import {
  useRef,
  useState } from 'react';
import '@azure/core-asynciterator-polyfill';

type UIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function useLlmAdapter({
  setMessages,
  messages,
}: {
  setMessages: (fn: (messages: UIMessage[]) => UIMessage[]) => void;
  messages: UIMessage[];
}) {
  const controller = useRef(new AbortController())
  return {
    send: async function(message: string) {
      if (!apple.isAvailable()) {
        return setMessages(messages => [
          ...messages,
          { role: 'user', content: message },
          {
            role: 'assistant',
            content: 'Thinking...',
          },
        ]);
      }
      controller.current.abort()
      controller.current = new AbortController()
      const assistantMessageIndex = messages.length + 1;
      setMessages(messages => [
        ...messages,
        { role: 'user', content: message },
        {
          role: 'assistant',
          content: 'Thinking...',
        },
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
        abortSignal: controller.current.signal,
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

const defaultMessages: UIMessage[] = [
  // {
  //   role: 'user',
  //   content: 'Hey! Can you explain how React Native works under the hood?',
  // },
  // {
  //   role: 'assistant',
  //   content:
  //     'React Native works by using a JavaScript thread that communicates with native platform threads through a bridge (or the new JSI architecture). When you write React components, they get translated into native views - so a <View> becomes a UIView on iOS and an android.view.View on Android. The JavaScript bundle runs in a JavaScript engine (like Hermes or JavaScriptCore), and updates to the UI are batched and sent to the native side for rendering. This is why React Native apps can achieve near-native performance while still allowing you to write code in JavaScript or TypeScript.',
  // },
  // {
  //   role: 'user',
  //   content:
  //     'That makes sense! What about the new architecture with Fabric and TurboModules?',
  // },
  // {
  //   role: 'assistant',
  //   content:
  //     "Great question! The new architecture introduces several key improvements:\n\n1. **Fabric** is the new rendering system that enables synchronous communication between JavaScript and native code. This means smoother animations and gestures because the UI thread can directly access JavaScript values without going through the async bridge.\n\n2. **TurboModules** replace the old Native Modules system. They're lazily loaded (only initialized when first used) and use JSI for direct communication, which is much faster than the old JSON serialization approach.\n\n3. **JSI (JavaScript Interface)** is the foundation that makes this possible - it's a lightweight C++ layer that lets JavaScript directly hold references to native objects and call methods on them synchronously.\n\nThe result is significantly better performance, especially for complex interactions and animations!",
  // },
  // {
  //   role: 'user',
  //   content: 'How do I handle keyboard avoiding in chat apps?',
  // },
  // {
  //   role: 'assistant',
  //   content:
  //     "Handling keyboard avoiding in chat apps can be tricky! Here are the main approaches:\n\n**On iOS:**\n- Use `KeyboardAvoidingView` with `behavior='padding'` and measure the keyboard height\n- For better results, use libraries like `react-native-keyboard-controller` which provides native-driven animations\n- Make sure your FlatList/ScrollView has `keyboardDismissMode` and `keyboardShouldPersistTaps` configured\n\n**On Android:**\n- Set `android:windowSoftInputMode='adjustResize'` in your AndroidManifest.xml\n- The keyboard avoiding is handled more automatically, but you may need to adjust for different behaviors\n\n**Pro tips:**\n- Animate your input container to move with the keyboard for a polished feel\n- Consider using `useAnimatedKeyboard` from Reanimated for smooth, interruptible animations\n- Don't forget to handle the safe area at the bottom of the screen!",
  // },
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
];

export function useLlmMessages() {
  let [messages, setMessages] = useState<UIMessage[]>(defaultMessages);

  if (messages.at(-1)?.role === 'user') {
    // optimistic system message
    messages = [...messages, { role: 'assistant', content: 'Thinking...' }];
  }

  return {
    messages,
    setMessages,
  };
}
