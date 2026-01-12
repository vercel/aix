import './src/polyfill';

import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  Button,
  Keyboard,
} from 'react-native';
import { Aix, AixCell, AixFooter, useAixRef } from 'aix';
import { useAppleChat, useMessages } from './src/apple';
import {
  KeyboardProvider,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { LegendList } from '@legendapp/list';

function App(): React.JSX.Element {
  const aix = useAixRef();

  const { messages, setMessages } = useMessages();
  const { send } = useAppleChat({ setMessages, messages });

  const inputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState('');

  const mainScrollViewID = 'chat-list-scroll-view';

  const safeAreaInsetsBottom = 18;

  const renderItem = (
    message: (typeof messages)[number],
    index: number,
    arr: readonly (typeof messages)[number][],
  ) => {
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
  };

  const examples = {
    scrollview: () => {
      return (
        <ScrollView
          keyboardDismissMode="interactive"
          nativeID={mainScrollViewID}
        >
          {messages.map(renderItem)}
        </ScrollView>
      );
    },
    legendlist: () => {
      return (
        <LegendList
          data={messages}
          renderItem={({ item, index, data }) => renderItem(item, index, data)}
          keyExtractor={(item, index) => `${item.role}-${index}`}
          nativeID={mainScrollViewID}
          keyboardDismissMode="interactive"
          maintainVisibleContentPosition
          getItemType={item => item.role}
        />
      );
    },
  };

  return (
    <KeyboardProvider>
      <Aix
        shouldStartAtEnd={true}
        scrollOnComposerSizeUpdate={true}
        style={styles.container}
        ref={aix}
        additionalContentInsets={{
          bottom: {
            whenKeyboardClosed: safeAreaInsetsBottom,
            whenKeyboardOpen: 0,
          },
        }}
        scrollIndicatorInsets={{
          bottom: {
            whenKeyboardClosed: safeAreaInsetsBottom,
            whenKeyboardOpen: 0,
          },
        }}
        mainScrollViewID={mainScrollViewID}
      >
        {examples.legendlist()}
        <KeyboardStickyView
          offset={{ opened: 0, closed: -safeAreaInsetsBottom }}
        >
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
                  autoFocus
                />
              </View>

              <Button
                title="Send"
                onPress={async () => {
                  aix.current?.scrollToIndexWhenBlankSizeReady(
                    messages.length + 1,
                    true,
                  );

                  send(inputValue);
                  inputRef.current?.clear();
                  requestAnimationFrame(Keyboard.dismiss);
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
    backgroundColor: '#0000ff30',
  },
});

export default App;
