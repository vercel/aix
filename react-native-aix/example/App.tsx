import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Aix, AixCellView } from 'react-native-aix';

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Aix
        shouldStartAtEnd={true}
        scrollOnComposerSizeUpdate={true}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          bounces
          alwaysBounceVertical
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
