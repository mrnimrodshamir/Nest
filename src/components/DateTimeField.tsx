import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme, typography, spacing, radius } from '@/theme';

interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  hasValue?: boolean;
  placeholder?: string;
}

export function DateTimeField({ label, value, onChange, minimumDate, hasValue = true, placeholder = 'Choose date and time' }: DateTimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');
  const [pendingAndroidDate, setPendingAndroidDate] = useState<Date | null>(null);

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
      <Pressable
        style={styles.field}
        onPress={() => {
          setAndroidStep('date');
          setPendingAndroidDate(null);
          setShowPicker(true);
        }}
      >
        <Text style={[styles.value, !hasValue && styles.placeholder]}>
          {hasValue ? formatted : placeholder}
        </Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={value}
          mode={Platform.OS === 'ios' ? 'datetime' : androidStep}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          onChange={(event, selectedDate) => {
            if (event.type === 'dismissed') {
              if (Platform.OS !== 'ios') setShowPicker(false);
              return;
            }
            if (!selectedDate) return;
            if (Platform.OS === 'android' && androidStep === 'date') {
              const next = new Date(selectedDate);
              next.setHours(value.getHours(), value.getMinutes(), 0, 0);
              setPendingAndroidDate(next);
              setAndroidStep('time');
              return;
            }
            if (Platform.OS === 'android') {
              const next = new Date(pendingAndroidDate ?? value);
              next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
              setShowPicker(false);
              setPendingAndroidDate(null);
              onChange(next);
              return;
            }
            onChange(selectedDate);
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
  placeholder: { color: theme.text.muted },
  doneButton: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  doneLabel: { ...typography.bodyMedium, color: theme.text.accent },
});
