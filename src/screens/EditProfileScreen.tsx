import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, PencilSimple, Star, Trash, Plus } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AvatarPicker } from '@/components/AvatarPicker';
import { DateOfBirthField } from '@/components/DateOfBirthField';
import { isNonEmpty, isValidPhone } from '@/utils/validation';
import { formatBabyAge, birthdateToMonths } from '@/utils/babyAge';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import type { Child } from '@/types/child';

interface EditProfileScreenProps {
  onBack: () => void;
}

export function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const { profile, session, updateProfileDetails } = useAuth();
  const { children, addChild, updateChild, removeChild, setDefaultChild } = useChildren(session?.user.id ?? null);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Synchronous guard alongside isSaving (state) — a fast double-tap can
  // fire two onPress handlers before the disabled-button re-render commits.
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (inFlightRef.current) return;
    const errors: Record<string, string> = {};
    if (!isNonEmpty(displayName)) errors.displayName = 'Enter your name';
    if (phone.trim() && !isValidPhone(phone)) errors.phone = 'Enter a valid phone number';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    inFlightRef.current = true;
    setFormError(null);
    setIsSaving(true);
    const result = await updateProfileDetails({
      displayName: displayName.trim(),
      phone: phone.trim() || null,
      photoUri,
    });
    setIsSaving(false);
    inFlightRef.current = false;
    if (result) setFormError(result);
    else onBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AvatarPicker uri={photoUri ?? profile?.avatarUrl ?? null} onChange={setPhotoUri} />

          <View style={styles.form}>
            <FormField
              label="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              error={fieldErrors.displayName}
            />
            <FormField
              label="Phone number (optional)"
              placeholder="Private — only you can see this"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              error={fieldErrors.phone}
            />
          </View>

          <Text style={styles.sectionLabel}>Children</Text>
          <ChildrenEditor
            children={children}
            onAdd={addChild}
            onUpdate={updateChild}
            onRemove={removeChild}
            onSetDefault={setDefaultChild}
          />

          {formError && <Text style={styles.formError}>{formError}</Text>}

          <PrimaryButton label="Save changes" onPress={handleSave} loading={isSaving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface ChildrenEditorProps {
  children: Child[];
  onAdd: (input: { name: string; birthdate: string | null }) => Promise<string | null>;
  onUpdate: (id: string, input: { name: string; birthdate: string | null }) => Promise<string | null>;
  onRemove: (id: string) => Promise<string | null>;
  onSetDefault: (id: string) => Promise<string | null>;
}

/** Inline add/edit — no separate screen needed for something this small.
 *  Kept simple deliberately: a mother with one child never sees anything
 *  but that child and an unobtrusive "+ Add another child". */
function ChildrenEditor({ children, onAdd, onUpdate, onRemove, onSetDefault }: ChildrenEditorProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Without this, a fast double-tap on "Save" while adding a new child can
  // fire onAdd() twice before the disabled-button re-render commits,
  // creating two duplicate child rows.
  const inFlightRef = useRef(false);

  const startAdd = () => {
    setEditingId('new');
    setName('');
    setBirthdate(null);
    setError(null);
  };

  const startEdit = (child: Child) => {
    setEditingId(child.id);
    setName(child.name);
    setBirthdate(child.birthdate);
    setError(null);
  };

  const handleSave = async () => {
    if (inFlightRef.current) return;
    if (!isNonEmpty(name)) return setError("Enter the child's name");
    if (!birthdate) return setError("Select the child's date of birth");
    inFlightRef.current = true;
    setIsSaving(true);
    const result =
      editingId === 'new'
        ? await onAdd({ name: name.trim(), birthdate })
        : await onUpdate(editingId!, { name: name.trim(), birthdate });
    setIsSaving(false);
    inFlightRef.current = false;
    if (result) setError(result);
    else setEditingId(null);
  };

  const confirmRemove = (child: Child) => {
    Alert.alert(`Remove ${child.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(child.id) },
    ]);
  };

  return (
    <View style={styles.childrenCard}>
      {children.map((child) => (
        <View key={child.id} style={styles.childRow}>
          <Pressable
            onPress={() => onSetDefault(child.id)}
            accessibilityLabel={child.isDefault ? `${child.name} is the default child` : `Set ${child.name} as default`}
            hitSlop={13}
          >
            <Star size={18} color={child.isDefault ? theme.brand.secondary : theme.border.strong} weight={child.isDefault ? 'fill' : 'regular'} />
          </Pressable>
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.childAge}>
              {child.birthdate ? formatBabyAge(birthdateToMonths(child.birthdate)) : ''}
              {child.isDefault ? ' · Default for matching' : ''}
            </Text>
          </View>
          <Pressable onPress={() => startEdit(child)} accessibilityLabel={`Edit ${child.name}`} hitSlop={14}>
            <PencilSimple size={16} color={theme.text.secondary} />
          </Pressable>
          {children.length > 1 && (
            <Pressable onPress={() => confirmRemove(child)} accessibilityLabel={`Remove ${child.name}`} hitSlop={14}>
              <Trash size={16} color={theme.semantic.danger} />
            </Pressable>
          )}
        </View>
      ))}

      {editingId ? (
        <View style={styles.childEditor}>
          <FormField label="Child's name" value={name} onChangeText={setName} autoCapitalize="words" />
          <DateOfBirthField value={birthdate} onChange={setBirthdate} />
          {error && <Text style={styles.formError}>{error}</Text>}
          <View style={styles.childEditorActions}>
            <Pressable style={styles.childCancel} onPress={() => setEditingId(null)}>
              <Text style={styles.childCancelLabel}>Cancel</Text>
            </Pressable>
            <View style={styles.childSaveButton}>
              <PrimaryButton label="Save" onPress={handleSave} loading={isSaving} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addChildRow} onPress={startAdd}>
          <Plus size={16} color={theme.text.accent} />
          <Text style={styles.addChildLabel}>Add another child</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  content: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'], gap: spacing.lg, alignItems: 'stretch' },
  form: { gap: spacing.lg },
  sectionLabel: { ...typography.bodyMedium, color: theme.text.primary, marginTop: spacing.sm },
  childrenCard: {
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    padding: spacing.md,
    gap: spacing.md,
  },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childInfo: { flex: 1 },
  childName: { ...typography.bodyMedium, color: theme.text.primary },
  childAge: { ...typography.caption, color: theme.text.muted },
  childEditor: { gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default },
  childEditorActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childCancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  childCancelLabel: { ...typography.bodyMedium, color: theme.text.secondary },
  childSaveButton: { flex: 1 },
  addChildRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  addChildLabel: { ...typography.bodyMedium, color: theme.text.accent },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
