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

  const scrollToEndForIndex = useRef<number | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState('');

  const lastMessageIndex = messages.length - 1;

  useEffect(() => {
    if (scrollToEndForIndex.current === lastMessageIndex) {
      scrollToEndForIndex.current = null;
      aix.current?.scrollToIndexWhenBlankSizeReady(
        lastMessageIndex,
        true,
        false,
      );
    }
  }, [lastMessageIndex]);

  return (
    <KeyboardProvider>
      <Aix
        shouldStartAtEnd={true}
        scrollOnComposerSizeUpdate={true}
        style={styles.container}
        ref={aix}
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
        <KeyboardStickyView
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          }}
          offset={{ opened: 0, closed: 0 }}
        >
          <AixFooter
            style={{
              backgroundColor: '#111111',
              flexDirection: 'row',
              padding: 16,
              height: 0,
            }}
          >
            <TextInput
              onChangeText={setInputValue}
              style={{ flex: 1, color: 'white' }}
              placeholderTextColor="#ffffff40"
              placeholder="Type something..."
              ref={inputRef}
            />

            <Button
              title="Send"
              onPress={async () => {
                Keyboard.dismiss();
                scrollToEndForIndex.current = messages.length + 1;
                inputRef.current?.clear();
                send(inputValue);
              }}
            />
          </AixFooter>
        </KeyboardStickyView>
      </Aix>
    </KeyboardProvider>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <View
      style={{
        backgroundColor: '#333333',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        marginHorizontal: 16,
        alignSelf: 'flex-end',
        maxWidth: '80%',
      }}
    >
      <Text style={{ color: '#ffffff' }}>{content}</Text>
    </View>
  );
}

function AssistantMessage({ content }: { content: string }) {
  return <Text style={{ color: '#ffffff', padding: 16 }}>{content}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: 'pink',
  },
  view: {
    width: 200,
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
});

export default App;
