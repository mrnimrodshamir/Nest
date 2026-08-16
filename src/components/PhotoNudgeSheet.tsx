import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useI18n } from '@/i18n';

interface PhotoNudgeSheetProps {
  visible: boolean;
  onAddPhoto: (uri: string) => void;
  onDismiss: () => void;
}

/** Shown exactly once, right after a first successful join -- never blocks
 *  joining, chatting, or anything else. Purely a nudge: skip is always one
 *  tap away and just as final as adding a photo. */
export function PhotoNudgeSheet({ visible, onAddPhoto, onDismiss }: PhotoNudgeSheetProps) {
  const { t } = useI18n();
  const [isPicking, setIsPicking] = useState(false);

  const handleAddPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    setIsPicking(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    setIsPicking(false);
    if (!result.canceled && result.assets[0]) {
      onAddPhoto(result.assets[0].uri);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            <Camera size={26} color={theme.brand.primary} weight="fill" />
          </View>
          <Text style={styles.title}>{t('photoNudge.title')}</Text>
          <Text style={styles.body}>{t('photoNudge.body')}</Text>

          <Pressable style={styles.addButton} onPress={handleAddPhoto} disabled={isPicking}>
            <Text style={styles.addLabel}>{isPicking ? t('photoNudge.choosing') : t('photoNudge.add')}</Text>
          </Pressable>
          <Pressable style={styles.notNow} onPress={onDismiss}>
            <Text style={styles.notNowLabel}>{t('common.notNow')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43,43,40,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.background.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.title3, color: theme.text.primary, marginBottom: spacing.sm },
  body: {
    ...typography.subhead,
    color: theme.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  addButton: {
    backgroundColor: theme.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    width: '100%',
    alignItems: 'center',
  },
  addLabel: { ...typography.bodyMedium, color: theme.text.inverse },
  notNow: { paddingVertical: spacing.md },
  notNowLabel: { ...typography.bodyMedium, color: theme.text.secondary },
});
