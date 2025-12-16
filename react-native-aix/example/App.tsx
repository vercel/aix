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

const list = Array.from({ length: 10_000 }, (_, index) => ({
  height: index % 2 === 1 ? 1200 * Math.random() : 800 * Math.random(),
  backgroundColor: index % 2 === 0 ? '#333' : '#222222',
}));

function App(): React.JSX.Element {
  const aix = useAixRef();

  const [numMessages, setNumMessages] = useState(20);
  const messages = Array.from({ length: numMessages }, (_, index) => index);

  const shouldScrollToEnd = useRef<number | null>(null);

  const lastMessageIndex = numMessages - 1;

  useEffect(() => {
    if (shouldScrollToEnd.current === lastMessageIndex) {
      shouldScrollToEnd.current = null;
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
        {messages.map((index, _, arr) => {
          const isLast = index === arr.length - 1;
          return (
            <AixCell key={index} index={index} isLast={isLast}>
              <View style={[styles.view, list[index]]}>
                <Text style={{ color: '#ffffff' }}>{index}</Text>
              </View>
            </AixCell>
          );
        })}
      </ScrollView>
      <AixFooter
        style={{
          position: 'absolute',
          top: 80,
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
            const nextNumMessages = numMessages + 2;
            shouldScrollToEnd.current = nextNumMessages - 1;
            setNumMessages(nextNumMessages);
          }}
        />
      </AixFooter>
    </Aix>
  );
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
