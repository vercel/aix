import './src/polyfill';

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  Button,
  Keyboard,
} from 'react-native';
import { Aix, AixCell, AixFooter, useAixRef } from 'react-native-aix';
import { useAppleChat, useMessages } from './src/apple';
import {
  KeyboardProvider,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';

function App(): React.JSX.Element {
  const aix = useAixRef();

  const { messages, setMessages } = useMessages();
  const { send } = useAppleChat({ setMessages, messages });

  const inputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState('');

  return (
    <KeyboardProvider>
      <Aix
        shouldStartAtEnd={true}
        scrollOnComposerSizeUpdate={true}
        style={styles.container}
        ref={aix}
        additionalContentInsets={{
          bottom: {
            // Safe area under composer when keyboard is closed
            whenKeyboardClosed: 0,
            // No safe area needed when keyboard is open (keyboard covers it)
            whenKeyboardOpen: 0,
          },
        }}
      >
        <ScrollView keyboardDismissMode="interactive">
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
        <KeyboardStickyView offset={{ opened: 0, closed: -18 }}>
          <AixFooter style={styles.footer}>
            <View style={styles.footerRow}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <TextInput
                  onChangeText={setInputValue}
                  style={[styles.input]}
                  placeholderTextColor="#ffffff40"
                  placeholder="Type something..."
                  ref={inputRef}
                  multiline
                />
              </View>

              <Button
                title="Send"
                onPress={async () => {
                  aix.current?.scrollToIndexWhenBlankSizeReady(
                    messages.length + 1,
                    true,
                    false,
                  );
                  Keyboard.dismiss();
                  inputRef.current?.clear();
                  send(inputValue);
                }}
              />
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
  return <Text style={[styles.text, { padding: 16 }]}>{content}</Text>;
}

const fontSize = 17;
const lineHeight = (fontSize: number) => fontSize * 1.4;

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
    color: '#ffffff',
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  input: {
    fontSize,
    color: '#ffffff',
    backgroundColor: '#111111',
    padding: 12,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
  },
  userMessage: {
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 16,
    alignSelf: 'flex-end',
    maxWidth: '70%',
    borderCurve: 'continuous',
  },
  footer: {
    paddingHorizontal: 16,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default App;
