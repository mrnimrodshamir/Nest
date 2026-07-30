import React from 'react';
import { SafeAreaView, Text, Pressable, StyleSheet } from 'react-native';

interface ProfileLoadedCheckpointProps {
  onContinue: () => void;
}

/** Second brute-force stability checkpoint: sits between a complete
 *  profile being confirmed and MainNavigator mounting. Same plain,
 *  static implementation as SessionLoadedCheckpoint — separates "profile
 *  loaded" from "main app mounted" so a crash after this tap points
 *  specifically at MainNavigator/Home rather than the session/profile
 *  load itself. */
export function ProfileLoadedCheckpoint({ onContinue }: ProfileLoadedCheckpointProps) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Profile loaded successfully</Text>
      <Pressable style={styles.button} onPress={onContinue} accessibilityRole="button">
        <Text style={styles.buttonLabel}>Continue</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', padding: 24, gap: 16 },
  text: { fontSize: 17, color: '#000000', textAlign: 'center' },
  button: { backgroundColor: '#000000', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8, marginTop: 8 },
  buttonLabel: { color: '#ffffff', fontSize: 16 },
});
