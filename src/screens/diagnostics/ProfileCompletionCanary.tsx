import React from 'react';
import { SafeAreaView, Text, Pressable, StyleSheet } from 'react-native';

interface ProfileCompletionCanaryProps {
  onContinue: () => void;
}

/** Diagnostic-only boundary (EXPO_PUBLIC_DISABLE_AUTH_WORKLETS) between a
 *  session with an incomplete profile being established and the real
 *  profile/children completion screen mounting. No animation, no image,
 *  no data hooks, no children form. Remove once the crash is isolated. */
export function ProfileCompletionCanary({ onContinue }: ProfileCompletionCanaryProps) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Session established (diagnostic mode)</Text>
      <Text style={styles.subtext}>Profile incomplete — the real completion screen has not mounted yet.</Text>
      <Pressable style={styles.button} onPress={onContinue} accessibilityRole="button">
        <Text style={styles.buttonLabel}>Continue to profile setup</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', padding: 24, gap: 16 },
  text: { fontSize: 17, color: '#000000', textAlign: 'center' },
  subtext: { fontSize: 14, color: '#666666', textAlign: 'center' },
  button: { backgroundColor: '#000000', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8, marginTop: 8 },
  buttonLabel: { color: '#ffffff', fontSize: 16 },
});
