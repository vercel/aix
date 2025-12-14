import React from 'react';
import { View, StyleSheet, ScrollView, TextInput, Text } from 'react-native';
import { Aix, AixCellView, AixComposer } from 'react-native-aix';

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Aix
        shouldStartAtEnd={true}
        scrollOnComposerSizeUpdate={true}
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
        >
          {Array.from({ length: 20 }).map((_, index, arr) => {
            const isLast = index === arr.length - 1;
            return (
              <AixCellView key={index} index={index} isLast={isLast}>
                <View
                  style={[
                    styles.view,
                    {
                      height: index % 2 === 1 ? 40 : 100,
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
      </Aix>
      <AixComposer
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <TextInput
          style={{ height: 80, backgroundColor: '#111111' }}
          placeholder="Type something..."
        />
      </AixComposer>
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
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
});

export default App;
