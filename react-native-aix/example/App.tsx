import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Aix, AixCellView } from 'react-native-aix';

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Aix shouldStartAtEnd={true} scrollOnComposerSizeUpdate={true}>
        <ScrollView
          contentContainerStyle={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          bounces
          alwaysBounceVertical
        >
          <AixCellView index={0} isLast={false}>
            <View style={styles.view}></View>
          </AixCellView>
          <AixCellView index={1} isLast>
            <View style={styles.view}></View>
          </AixCellView>
        </ScrollView>
      </Aix>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
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
