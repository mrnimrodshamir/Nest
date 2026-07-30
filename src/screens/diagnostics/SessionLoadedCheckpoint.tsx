import React from 'react';
import { SafeAreaView, Text, Pressable, StyleSheet } from 'react-native';

interface SessionLoadedCheckpointProps {
  onContinue: () => void;
}

/** Brute-force stability checkpoint: sits between session becoming
 *  non-null and mounting any real onboarding/main UI. Plain
 *  SafeAreaView/Text/Pressable only — no animation, no map, no location,
 *  no notifications, no bottom sheet, no Reanimated, no custom
 *  transition. Manual tap required to proceed, so a crash on either side
 *  of it identifies which side is at fault. */
export function SessionLoadedCheckpoint({ onContinue }: SessionLoadedCheckpointProps) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Session loaded successfully</Text>
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
