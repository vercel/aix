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

const list = Array.from({ length: 10_000 }, (_, index) => ({
  height: index % 2 === 1 ? 1200 * Math.random() : 800 * Math.random(),
  backgroundColor: index % 2 === 0 ? '#333' : '#222222',
}));

function App(): React.JSX.Element {
  const aix = useAixRef();

  const { messages, setMessages } = useMessages();
  const { send } = useAppleChat({ setMessages, messages });

  const scrollToEndForIndex = useRef<number | null>(null);

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
      <Aix
        shouldStartAtEnd={true}
        scrollOnComposerSizeUpdate={true}
        style={styles.container}
        ref={aix}
      >
        <ScrollView
          bounces
          alwaysBounceVertical
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.scrollView}
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
        <AixFooter
          style={{
            position: 'absolute',
            bottom: 400,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            height: 100,
            backgroundColor: '#111111',
            flexDirection: 'row',
          }}
        >
            <TextInput style={{ flex: 1 }} placeholder="Type something..." />

            <Button
              title="Scroll to last"
              onPress={async () => {
                Keyboard.dismiss();
                scrollToEndForIndex.current = messages.length + 1;
                send('Hi how are you');
              }}
            />
        </AixFooter>
      </Aix>
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
  },
  scrollView: {},
  view: {
    width: 200,
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
});

export default App;
