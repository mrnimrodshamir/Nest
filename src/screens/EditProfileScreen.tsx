import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, PencilSimple, Star, Trash, Plus } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AvatarPicker } from '@/components/AvatarPicker';
import { DateOfBirthField } from '@/components/DateOfBirthField';
import { isNonEmpty } from '@/utils/validation';
import { formatBabyAge, birthdateToMonths } from '@/utils/babyAge';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { parentRoleNoun, type ParentRole } from '@/utils/parentRole';
import type { Child, ChildSex } from '@/types/child';

interface EditProfileScreenProps {
  onBack: () => void;
}

export function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const { profile, session, updateProfileDetails } = useAuth();
  const { children, addChild, updateChild, removeChild, setDefaultChild } = useChildren(session?.user.id ?? null);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  // Self-selected only. Existing users start at null and simply keep reading
  // "Parent" until they choose — nobody is forced to pick.
  const [parentRole, setParentRole] = useState<ParentRole>(profile?.parentRole ?? null);
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
      setParentRole(profile.parentRole ?? null);
    }
  }, [profile]);

  const handleSave = async () => {
    if (inFlightRef.current) return;
    const errors: Record<string, string> = {};
    if (!isNonEmpty(displayName)) errors.displayName = 'Enter your name';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    inFlightRef.current = true;
    setFormError(null);
    setIsSaving(true);
    // Phone has no UI here anymore (no product use for it) — pass the
    // profile's existing value straight through so pre-existing DB data
    // is preserved rather than silently wiped.
    const result = await updateProfileDetails({
      displayName: displayName.trim(),
      phone: profile?.phone ?? null,
      photoUri,
      parentRole,
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
          <Text style={styles.headerTitle}>Profile & children</Text>
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
          </View>

          <Text style={styles.sectionLabel}>How you'd like to be called</Text>
          <Text style={styles.roleHint}>
            Shown as "{parentRoleNoun(parentRole)} of 2" on your public profile. Optional — you can change it any time.
          </Text>
          <View style={styles.roleRow}>
            {(['mom', 'dad', 'parent'] as const).map((option) => {
              const selected = parentRole === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setParentRole(selected ? null : option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={parentRoleNoun(option)}
                  style={[styles.roleChip, selected && styles.roleChipSelected]}
                >
                  <Text style={[styles.roleChipLabel, selected && styles.roleChipLabelSelected]}>
                    {parentRoleNoun(option)}
                  </Text>
                </Pressable>
              );
            })}
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

interface ChildrenEditorInput {
  name: string;
  birthdate: string | null;
  sex?: ChildSex | null;
}

interface ChildrenEditorProps {
  children: Child[];
  onAdd: (input: ChildrenEditorInput) => Promise<string | null>;
  onUpdate: (id: string, input: ChildrenEditorInput) => Promise<string | null>;
  onRemove: (id: string) => Promise<string | null>;
  onSetDefault: (id: string) => Promise<string | null>;
}

/** Inline add/edit — no separate screen needed for something this small.
 *  Kept simple deliberately: a parent with one child never sees anything
 *  but that child and an unobtrusive "+ Add another child". */
function ChildrenEditor({ children, onAdd, onUpdate, onRemove, onSetDefault }: ChildrenEditorProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [sex, setSex] = useState<ChildSex | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);
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
    setSex(null);
    setMakeDefault(false);
    setError(null);
  };

  const startEdit = (child: Child) => {
    setEditingId(child.id);
    setName(child.name);
    setBirthdate(child.birthdate);
    setSex(child.sex);
    setMakeDefault(child.isDefault);
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
        ? await onAdd({ name: name.trim(), birthdate, sex })
        : await onUpdate(editingId!, { name: name.trim(), birthdate, sex });
    // A newly-added child auto-becomes default only when it's the first
    // child (useChildren's own rule); the "Use as default child" toggle
    // here only needs to act when the parent explicitly wants to switch
    // the default onto this child.
    if (!result && makeDefault && editingId !== 'new') {
      await onSetDefault(editingId as string);
    }
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
            <Text style={styles.childName}>
              {child.name}
              {child.sex ? ` · ${child.sex === 'male' ? 'Boy' : 'Girl'}` : ''}
            </Text>
            <Text style={styles.childAge}>{child.birthdate ? formatBabyAge(birthdateToMonths(child.birthdate)) : ''}</Text>
          </View>
          {child.isDefault && (
            <View style={styles.defaultPill}>
              <Text style={styles.defaultPillLabel}>Default for matching</Text>
            </View>
          )}
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

          <View style={styles.sexRow}>
            <Text style={styles.sexLabel}>Gender</Text>
            <View style={styles.sexButtons}>
              <Pressable
                style={[styles.sexButton, sex === 'male' && styles.sexButtonSelected]}
                onPress={() => setSex('male')}
              >
                <Text style={[styles.sexButtonLabel, sex === 'male' && styles.sexButtonLabelSelected]}>Boy</Text>
              </Pressable>
              <Pressable
                style={[styles.sexButton, sex === 'female' && styles.sexButtonSelected]}
                onPress={() => setSex('female')}
              >
                <Text style={[styles.sexButtonLabel, sex === 'female' && styles.sexButtonLabelSelected]}>Girl</Text>
              </Pressable>
            </View>
          </View>

          {editingId !== 'new' && (
            <Pressable style={styles.defaultToggleRow} onPress={() => setMakeDefault((v) => !v)}>
              <View style={[styles.checkbox, makeDefault && styles.checkboxChecked]}>
                {makeDefault && <Star size={11} color={theme.text.inverse} weight="fill" />}
              </View>
              <Text style={styles.defaultToggleLabel}>Use as default child for activity matching</Text>
            </Pressable>
          )}

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
  defaultPill: {
    backgroundColor: theme.brand.secondaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  defaultPillLabel: { ...typography.caption, color: theme.brand.secondary },
  sexRow: { gap: spacing.xs },
  sexLabel: { ...typography.footnote, color: theme.text.secondary },
  sexButtons: { flexDirection: 'row', gap: spacing.sm },
  sexButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border.default,
    backgroundColor: theme.background.surface,
  },
  sexButtonSelected: { borderColor: theme.brand.primary, backgroundColor: theme.brand.primaryTint },
  sexButtonLabel: { ...typography.bodyMedium, color: theme.text.secondary },
  sexButtonLabelSelected: { color: theme.brand.primary },
  defaultToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: theme.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: theme.brand.secondary, borderColor: theme.brand.secondary },
  defaultToggleLabel: { ...typography.footnote, color: theme.text.primary, flexShrink: 1 },
  childEditor: { gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default },
  childEditorActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childCancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  childCancelLabel: { ...typography.bodyMedium, color: theme.text.secondary },
  childSaveButton: { flex: 1 },
  roleHint: { ...typography.footnote, color: theme.text.secondary, marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  roleChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill,
    borderWidth: 1, borderColor: theme.border.default, backgroundColor: theme.background.surface,
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  roleChipSelected: { borderColor: theme.brand.primary, backgroundColor: theme.brand.primaryTint },
  roleChipLabel: { ...typography.subhead, color: theme.text.primary },
  roleChipLabelSelected: { color: theme.brand.primary, fontWeight: '600' },
  addChildRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  addChildLabel: { ...typography.bodyMedium, color: theme.text.accent },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
