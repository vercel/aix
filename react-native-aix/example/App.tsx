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
  PlatformColor,
  useColorScheme,
} from 'react-native';
import { Aix, AixCell, AixFooter, useAixRef } from 'react-native-aix';
import { useAppleChat, useMessages } from './src/apple';
import {
  KeyboardProvider,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';

function App(): React.JSX.Element {
  const aix = useAixRef();
  const colorScheme = useColorScheme();

  const { messages, setMessages } = useMessages();
  const { send } = useAppleChat({ setMessages, messages });

  const inputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputHeight, setInputHeight] = useState(44);

  const mainScrollViewID = 'chat-list-scroll-view';

  const safeAreaInsetsBottom = 18;

  return (
    <KeyboardProvider>
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
        <View style={styles.header}>
          <Text style={styles.headerText}>Chat</Text>
        </View>
        <ScrollView
          keyboardDismissMode="interactive"
          nativeID={mainScrollViewID}
        >
          {messages.map((message, index, arr) => {
            const isLast = index === arr.length - 1;
            return (
              <AixCell key={index} index={index} isLast={isLast}>
                {message.role === 'user' ? (
                  <UserMessage content={message.content} />
                ) : (
                  <AssistantMessage content={message.content} />
                )}
              </AixCell>
            );
          })}
        </ScrollView>
        <KeyboardStickyView
          offset={{
            opened: -paddingVertical / 2,
            closed: -safeAreaInsetsBottom - paddingVertical / 2,
          }}
        >
          <AixFooter style={styles.footer}>
            <View
              style={[
                styles.footerBackground,
                {
                  experimental_backgroundImage:
                    colorScheme === 'dark'
                      ? `linear-gradient(to bottom, #00000000, #000000)`
                      : `linear-gradient(to bottom, #ffffff00, #ffffff)`,
                },
              ]}
            />
            <View style={styles.footerRow}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <TextInput
                  onChangeText={setInputValue}
                  style={[styles.input, { height: inputHeight }]}
                  placeholderTextColor={PlatformColor('placeholderText')}
                  placeholder="Type something..."
                  ref={inputRef}
                  multiline
                  autoFocus
                />
              </View>

              <Pressable
                onLongPress={() => {
                  inputHeight > 120
                    ? setInputHeight(44)
                    : setInputHeight(inputHeight + 30);
                }}
                style={[
                  styles.button,
                  inputValue.length === 0
                    ? {
                        backgroundColor: PlatformColor('systemGray6'),
                        borderColor: PlatformColor('systemGray5'),
                      }
                    : {
                        backgroundColor: PlatformColor('systemGray3'),
                        borderColor: PlatformColor('separator'),
                      },
                ]}
                onPress={async () => {
                  aix.current?.scrollToIndexWhenBlankSizeReady(
                    messages.length + 1,
                    true,
                    false,
                  );

                  inputRef.current?.clear();
                  send(inputValue);
                  requestAnimationFrame(() => {
                    Keyboard.dismiss();
                  });
                }}
              >
                <Text style={styles.buttonText}>↑</Text>
              </Pressable>
            </View>
          </AixFooter>
        </KeyboardStickyView>
      </Aix>
    </KeyboardProvider>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <View style={styles.userMessage}>
      <Text style={[styles.text]}>{content}</Text>
    </View>
  );
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <Text
      style={[
        styles.text,
        { paddingHorizontal: gap(4), paddingVertical: gap(2) },
      ]}
    >
      {content}
    </Text>
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
    color: PlatformColor('label'),
  },
  footerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingVertical,
    gap: gap(3),
  },
  input: {
    fontSize,
    color: PlatformColor('label'),
    backgroundColor: PlatformColor('systemBackground'),
    borderWidth: 1,
    borderColor: PlatformColor('separator'),
    paddingVertical: (44 - lineHeight(fontSize)) / 2,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: gap(4),
  },
  userMessage: {
    backgroundColor: PlatformColor('secondarySystemBackground'),
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
    backgroundColor: PlatformColor('systemGray8'),
    borderWidth: 1,
    borderColor: PlatformColor('separator'),
  },
  buttonText: {
    color: PlatformColor('label'),
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
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PlatformColor('systemBackground'),
    borderBottomWidth: 1,
    borderBottomColor: PlatformColor('separator'),
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: PlatformColor('label'),
  },
});

export default App;
