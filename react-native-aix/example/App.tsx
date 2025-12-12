import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Aix } from 'react-native-aix';

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
        <Aix isRed={true} style={styles.view} testID="aix" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  view: {
    width: 200,
    height: 200
  }});

export default App;