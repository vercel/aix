import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import { Aix, AixCellView, AixComposer } from 'react-native-aix';

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <AixComposer>
        <TextInput
          style={{ height: 100, backgroundColor: '#111111' }}
          placeholder="Type something..."
        />
      </AixComposer>
      <Aix
        shouldStartAtEnd={true}
        scrollOnComposerSizeUpdate={true}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          bounces
          alwaysBounceVertical
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.scrollView}
        >
          {Array.from({ length: 20 }).map((_, index, arr) => (
            <AixCellView
              key={index}
              index={index}
              isLast={index === arr.length - 1}
            >
              <View style={styles.view}></View>
            </AixCellView>
          ))}
        </ScrollView>
      </Aix>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollView: {
    gap: 12,
  },
  view: {
    width: 200,
    height: 200,
    backgroundColor: 'blue',
  },
});

export default App;
