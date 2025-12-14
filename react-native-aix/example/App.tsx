import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  Button,
} from 'react-native';
import { Aix, AixCellView, AixComposer, AixRef } from 'react-native-aix';
import { callback } from 'react-native-nitro-modules';

function App(): React.JSX.Element {
  const aix = useRef<AixRef | null>(null);

  const [numMessages, setNumMessages] = useState(20);

  return (
    <Aix
      shouldStartAtEnd={true}
      scrollOnComposerSizeUpdate={true}
      style={styles.container}
      hybridRef={callback(ref => {
        aix.current = ref;
      })}
    >
      <ScrollView
        bounces
        alwaysBounceVertical
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.scrollView}
      >
        {Array.from({ length: numMessages }).map((_, index, arr) => {
          const isLast = index === arr.length - 1;
          return (
            <AixCellView key={index} index={index} isLast={isLast}>
              <View
                style={[
                  styles.view,
                  {
                    height: index % 2 === 1 ? 150 : 300,
                    backgroundColor: index % 2 === 0 ? '#333' : '#222222',
                  },
                ]}
              >
                <Text style={{ color: '#ffffff' }}>{index}</Text>
              </View>
            </AixCellView>
          );
        })}
      </ScrollView>
      <AixComposer
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          height: 100,
          paddingBottom: 40,
          backgroundColor: '#111111',
          flexDirection: 'row',
        }}
      >
        <TextInput style={{ flex: 1 }} placeholder="Type something..." />

        <Button
          title="Scroll to last"
          onPress={() => {
            const nextNumMessages = numMessages + 2;
            setNumMessages(nextNumMessages);
            aix.current?.scrollToIndexWhenBlankSizeReady(nextNumMessages - 1);
          }}
        />
      </AixComposer>
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
