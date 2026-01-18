import './src/polyfill';

import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  Keyboard,
  Pressable,
  Platform,
  useColorScheme,
} from 'react-native';

// Cross-platform color helper - iOS uses system colors, Android uses fallbacks
const colors = {
  label: Platform.select({ ios: 'label', default: '#000000' }),
  placeholderText: Platform.select({ ios: 'placeholderText', default: '#8E8E93' }),
  separator: Platform.select({ ios: 'separator', default: '#C6C6C8' }),
  systemBackground: Platform.select({ ios: 'systemBackground', default: '#FFFFFF' }),
  secondarySystemBackground: Platform.select({ ios: 'secondarySystemBackground', default: '#F2F2F7' }),
  systemGray3: Platform.select({ ios: 'systemGray3', default: '#C7C7CC' }),
  systemGray5: Platform.select({ ios: 'systemGray5', default: '#E5E5EA' }),
  systemGray6: Platform.select({ ios: 'systemGray6', default: '#F2F2F7' }),
} as const;

// Dark mode variants
const darkColors = {
  label: Platform.select({ ios: 'label', default: '#FFFFFF' }),
  placeholderText: Platform.select({ ios: 'placeholderText', default: '#8E8E93' }),
  separator: Platform.select({ ios: 'separator', default: '#38383A' }),
  systemBackground: Platform.select({ ios: 'systemBackground', default: '#000000' }),
  secondarySystemBackground: Platform.select({ ios: 'secondarySystemBackground', default: '#1C1C1E' }),
  systemGray3: Platform.select({ ios: 'systemGray3', default: '#48484A' }),
  systemGray5: Platform.select({ ios: 'systemGray5', default: '#2C2C2E' }),
  systemGray6: Platform.select({ ios: 'systemGray6', default: '#1C1C1E' }),
} as const;
import {
  Aix,
  AixCell,
  AixFooter,
  useAixRef,
  TextFadeInStaggeredIfStreaming,
} from 'aix';
import { useAppleChat, useMessages } from './src/apple';
import {
  KeyboardProvider,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LegendList } from '@legendapp/list';
import { FlashList } from '@shopify/flash-list';

function CellRenderer({
  children,
  index,
  isLast,
  ...props
}: {
  children: React.ReactNode;
  index: number;
  isLast: boolean;
}) {
  return (
    <AixCell key={index} index={index} isLast={isLast} {...props}>
      {children}
    </AixCell>
  );
}

function Chat({ children }: { children: React.ReactNode }) {
  const aix = useAixRef();

  const { messages, setMessages } = useMessages();
  const { send } = useAppleChat({ setMessages, messages });
  const [animateMessageIndex, setAnimateMessageIndex] = useState<number | null>(
    null,
  );

  const renderItem = (message: (typeof messages)[number], index: number) =>
    message.role === 'user' ? (
      <UserMessage content={message.content} />
    ) : (
      <AssistantMessage
        content={message.content}
        shouldAnimate={animateMessageIndex === index}
      />
    );

  const examples = {
    scrollProps: {
      keyboardDismissMode: 'interactive',
      nativeID: mainScrollViewID,
    } satisfies Partial<React.ComponentProps<typeof ScrollView>>,
    
    legendList: () => (
      <LegendList
        {...examples.scrollProps}
        estimatedItemSize={100}
        data={messages}
        getItemType={item => item.role}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <CellRenderer index={index} isLast={index === messages.length - 1}>
            {renderItem(item, index)}
          </CellRenderer>
        )}
      />
    ),
    scrollview: () => (
      <ScrollView {...examples.scrollProps}>
        {messages.map((message, i) => (
          <CellRenderer
            index={messages.indexOf(message)}
            isLast={messages.indexOf(message) === messages.length - 1}
            key={i}
          >
            {renderItem(message, messages.indexOf(message))}
          </CellRenderer>
        ))}
      </ScrollView>
    ),
    flashList: () => (
      <FlashList
        {...examples.scrollProps}
        data={messages}
        getItemType={item => item.role}
        keyExtractor={(_, index) => index.toString()}
        CellRendererComponent={(props) => <CellRenderer isLast={props.index === messages.length - 1} {...props} />}
        renderItem={({ item, index }) => renderItem(item, index)}
      />
    ),
  };

  return (
    <Aix
      shouldStartAtEnd={true}
      scrollOnFooterSizeUpdate={{
        enabled: true,
        scrolledToEndThreshold: 200,
        animated: false,
      }}
      style={styles.container}
      ref={aix}
      additionalContentInsets={{
        bottom: {
          whenKeyboardClosed: safeAreaInsetsBottom,
          whenKeyboardOpen: 0,
        },
      }}
      additionalScrollIndicatorInsets={{
        bottom: {
          whenKeyboardClosed: safeAreaInsetsBottom,
          whenKeyboardOpen: 0,
        },
      }}
      mainScrollViewID={mainScrollViewID}
    >
      {children}
      {examples.scrollview()}
      <FloatingFooter>
        <AixFooter style={styles.footer}>
          <Composer
            onSubmit={message => {
              const nextAssistantMessageIndex = messages.length + 1;
              aix.current?.scrollToIndexWhenBlankSizeReady(
                nextAssistantMessageIndex,
                true,
                false,
              );
              setAnimateMessageIndex(nextAssistantMessageIndex);
              send(message);
            }}
          />
        </AixFooter>
      </FloatingFooter>
    </Aix>
  );
}

function FloatingFooter({ children }: { children: React.ReactNode }) {
  return (
    <StickyView
      offset={{
        opened: -paddingVertical / 2,
        closed: -safeAreaInsetsBottom - paddingVertical / 2,
      }}
    >
      {children}
    </StickyView>
  );
}

function Header() {
  const colorScheme = useColorScheme();
  const c = colorScheme === 'dark' ? darkColors : colors;
  return (
    <View style={[styles.header, { backgroundColor: c.systemBackground, borderBottomColor: c.separator }]}>
      <Text style={[styles.headerText, { color: c.label }]}>Chat</Text>
    </View>
  );
}

function App() {
  return (
    <KeyboardProvider>
      <Chat>
        <Header />
      </Chat>
    </KeyboardProvider>
  );
}

function Composer({ onSubmit }: { onSubmit: (message: string) => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? darkColors : colors;
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<TextInput>(null);
  return (
    <>
      <View
        style={[
          styles.footerBackground,
          {
            experimental_backgroundImage: isDark
              ? `linear-gradient(to bottom, #00000000, #000000)`
              : `linear-gradient(to bottom, #ffffff00, #ffffff)`,
          },
        ]}
      />
      <View style={styles.footerRow}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <TextInput
            onChangeText={setInputValue}
            style={[styles.input, { color: c.label, backgroundColor: c.systemBackground, borderColor: c.separator }]}
            placeholderTextColor={c.placeholderText}
            placeholder="Type something..."
            ref={inputRef}
            multiline
            value={inputValue}
            autoFocus
          />
        </View>

        <Pressable
          style={[
            styles.button,
            inputValue.length === 0
              ? {
                  backgroundColor: c.systemGray6,
                  borderColor: c.systemGray5,
                }
              : {
                  backgroundColor: c.systemGray3,
                  borderColor: c.separator,
                },
          ]}
          onPress={async () => {
            setInputValue('');
            onSubmit(inputValue);
            requestAnimationFrame(() => {
              Keyboard.dismiss();
            });
          }}
        >
          <Text style={[styles.buttonText, { color: c.label }]}>↑</Text>
        </Pressable>
      </View>
    </>
  );
}

function UserMessage({ content }: { content: string }) {
  const colorScheme = useColorScheme();
  const c = colorScheme === 'dark' ? darkColors : colors;
  return (
    <View style={[styles.userMessage, { backgroundColor: c.secondarySystemBackground }]}>
      <Text style={[styles.text, { color: c.label }]}>{content}</Text>
    </View>
  );
}

function AssistantMessage({
  content,
  shouldAnimate,
}: {
  content: string;
  shouldAnimate: boolean;
}) {
  const colorScheme = useColorScheme();
  const c = colorScheme === 'dark' ? darkColors : colors;
  return (
    <View>
      <Text
        style={[
          styles.text,
          { paddingHorizontal: gap(4), paddingVertical: gap(2), color: c.label },
        ]}
      >
        <TextFadeInStaggeredIfStreaming disabled={!shouldAnimate}>
          {content}
        </TextFadeInStaggeredIfStreaming>
      </Text>
    </View>
  );
}

function gap(size: number) {
  return size * 4;
}

const fontSize = 17;
const lineHeight = (fontSize: number) => fontSize * 1.4;
const paddingVertical = 8;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  view: {
    width: 200,
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
  text: {
    fontSize,
    lineHeight: lineHeight(fontSize),
  },
  footerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingVertical,
    gap: gap(3),
  },
  input: {
    fontSize,
    borderWidth: 1,
    paddingVertical: (44 - lineHeight(fontSize)) / 2,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: gap(4),
  },
  userMessage: {
    paddingHorizontal: gap(4),
    paddingVertical: gap(2),
    borderRadius: 20,
    marginHorizontal: gap(4),
    alignSelf: 'flex-end',
    maxWidth: '70%',
    borderCurve: 'continuous',
    marginVertical: gap(3),
  },
  footer: {
    paddingHorizontal: gap(4),
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  button: {
    height: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '500',
  },
  footerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -18 - 6,
  },
  header: {
    paddingHorizontal: gap(4),
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default App;

const mainScrollViewID = 'chat-list-scroll-view';

const safeAreaInsetsBottom = 18;

function StickyView(
  props: React.ComponentProps<typeof Animated.View> & {
    offset?: { opened?: number; closed?: number };
  },
) {
  const { height, progress } = useReanimatedKeyboardAnimation();

  const style = useAnimatedStyle(() => {
    const y =
      height.get() +
      interpolate(
        progress.get(),
        [0, 1],
        [props.offset?.closed ?? 0, props.offset?.opened ?? 0],
      );
    return {
      transform: [
        {
          translateY: y,
        },
      ],
    };
  });

  return <Animated.View {...props} style={[style, props.style]} />;
}
