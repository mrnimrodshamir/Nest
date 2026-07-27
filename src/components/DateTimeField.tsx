import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme, typography, spacing, radius } from '@/theme';

interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

export function DateTimeField({ label, value, onChange, minimumDate }: DateTimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const formatted = value.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setShowPicker(true)}>
        <Text style={styles.value}>{formatted}</Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={value}
          mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          onChange={(event, selectedDate) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (event.type === 'dismissed') return;
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Pressable style={styles.doneButton} onPress={() => setShowPicker(false)}>
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.footnote, color: theme.text.secondary },
  field: {
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  value: { ...typography.body, color: theme.text.primary },
  doneButton: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  doneLabel: { ...typography.bodyMedium, color: theme.text.accent },
});
