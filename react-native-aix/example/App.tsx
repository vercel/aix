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
        scrollEndReachedThreshold={200}
        style={{ flex: 1 }}
        onLayout={e => {
          console.log('[onLayout]', e.nativeEvent.layout.height);
        }}
      >
        <ScrollView
          // TODO support this?
          // contentInsetAdjustmentBehavior="automatic"
          bounces
          alwaysBounceVertical
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.scrollView}
          scrollIndicatorInsets={{ bottom: 0 }}
        >
          {Array.from({ length: 20 }).map((_, index, arr) => {
            const isLast = index === arr.length - 1;
            return (
              <AixCellView key={index} index={index} isLast={isLast}>
                <View
                  style={[
                    styles.view,
                    {
                      height: 300,
                      backgroundColor: index % 2 === 0 ? 'blue' : 'pink',
                    },
                  ]}
                ></View>
              </AixCellView>
            );
          })}
        </ScrollView>
        {/* <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'red',
            top: 'auto',
            height: 314,
          }}
        /> */}
      </Aix>
    </View>
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
    height: 100,
  },
});

export default App;
