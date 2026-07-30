import React from 'react';
import { SafeAreaView, Text, Pressable, StyleSheet } from 'react-native';

interface SessionRestoredScreenProps {
  onContinue: () => void;
}

/** Diagnostic-only boundary (EXPO_PUBLIC_DISABLE_AUTH_WORKLETS) between a
 *  completed session/profile being established and the real MainNavigator
 *  mounting. No animation, no map, no bottom sheet, no notifications
 *  hook, no location hook, no Supabase query beyond what already resolved
 *  to get here. Separates "session restored" from "main app mounted" so a
 *  crash on either side of the manual tap tells us which one is at
 *  fault. Remove once the crash is isolated. */
export function SessionRestoredScreen({ onContinue }: SessionRestoredScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Session established (diagnostic mode)</Text>
      <Text style={styles.subtext}>Profile complete — MainNavigator has not mounted yet.</Text>
      <Pressable style={styles.button} onPress={onContinue} accessibilityRole="button">
        <Text style={styles.buttonLabel}>Continue to main app</Text>
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
