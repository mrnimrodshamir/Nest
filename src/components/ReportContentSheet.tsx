import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useReportAndBlock } from '@/hooks/useReportAndBlock';
import { useI18n } from '@/i18n';
import { radius, spacing, theme, typography } from '@/theme';
import { REPORT_REASONS, type ReportReason, type ReportTarget } from '@/types/moderation';

export function ReportContentSheet({ visible, target, onClose }: { visible: boolean; target: ReportTarget | null; onClose: () => void }) {
  const { t, isRTL } = useI18n();
  const { submitReport } = useReportAndBlock();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const close = () => { setReason(null); setDetails(''); setResult(null); onClose(); };
  const submit = async () => {
    if (!target || !reason || saving) return;
    setSaving(true);
    const error = await submitReport({ target, reason, details });
    setSaving(false);
    if (error) setResult(error);
    else setResult(t('report.success'));
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <Pressable style={styles.backdrop} onPress={close} />
    <View style={styles.sheet}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('report.title')}</Text>
      {result ? <>
        <Text style={[styles.result, isRTL && styles.rtl]}>{result}</Text>
        <PrimaryButton label={t('common.done')} onPress={close} />
      </> : <>
        <ScrollView style={styles.reasons}>
          {REPORT_REASONS.map((item) => <Pressable key={item} style={[styles.reason, reason === item && styles.selected]} onPress={() => setReason(item)} accessibilityRole="radio" accessibilityState={{ selected: reason === item }}>
            <Text style={[styles.reasonText, isRTL && styles.rtl]}>{t(`report.reason.${item}`)}</Text>
          </Pressable>)}
        </ScrollView>
        <TextInput value={details} onChangeText={setDetails} placeholder={t('report.details')} placeholderTextColor={theme.text.muted} style={[styles.input, isRTL && styles.rtl]} maxLength={1000} multiline />
        <PrimaryButton label={t('report.submit')} onPress={() => void submit()} disabled={!reason || saving} />
        {saving ? <ActivityIndicator color={theme.brand.primary} /> : null}
      </>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: theme.background.app, padding: spacing.xl, paddingBottom: spacing['3xl'], borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: spacing.md },
  title: { ...typography.title2, color: theme.text.primary }, rtl: { textAlign: 'right', writingDirection: 'rtl' },
  reasons: { maxHeight: 300 }, reason: { minHeight: 48, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default },
  selected: { backgroundColor: theme.brand.primaryTint, borderRadius: radius.md, paddingHorizontal: spacing.sm }, reasonText: { ...typography.body, color: theme.text.primary },
  input: { minHeight: 88, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.md, padding: spacing.md, color: theme.text.primary, textAlignVertical: 'top' },
  result: { ...typography.body, color: theme.text.primary },
});
