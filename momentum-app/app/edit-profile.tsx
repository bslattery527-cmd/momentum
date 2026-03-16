import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { Colors, Typography, Spacing, BorderRadius, Layout } from '@/constants/theme';
import { api } from '@/lib/api';
import { uploadAvatar, type AvatarUploadAsset } from '@/lib/avatarUpload';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { UpdateUserPayload, User } from '@/types';

const GOAL_CATEGORIES = [
  { id: 'reading', label: 'Reading', icon: '📚' },
  { id: 'coding', label: 'Coding', icon: '💻' },
  { id: 'writing', label: 'Writing', icon: '✍️' },
  { id: 'study', label: 'Study', icon: '🎓' },
  { id: 'creative', label: 'Creative', icon: '🎨' },
  { id: 'other', label: 'Other', icon: '⚡' },
];

export default function EditProfileScreen() {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [goalCategory, setGoalCategory] = useState(user?.goal_category ?? null);
  const [avatarAsset, setAvatarAsset] = useState<AvatarUploadAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canSave = useMemo(() => displayName.trim().length >= 2 && !isSaving, [displayName, isSaving]);
  const avatarPreviewUri = avatarAsset?.uri ?? user?.avatar_url ?? null;

  const pickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to update your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAvatarAsset({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
      });
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('Missing info', 'Please enter a display name.');
      return;
    }

    setIsSaving(true);

    try {
      const payload: UpdateUserPayload = {
        display_name: displayName.trim(),
        bio: bio.trim() ? bio.trim() : null,
        goal_category: goalCategory,
      };

      if (avatarAsset) {
        payload.avatar_url = await uploadAvatar(avatarAsset);
      }

      const response = await api.put('/users/me', payload);
      const updatedUser = response.data as User;

      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      router.back();
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ??
        'Could not save your profile. Please try again.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  }, [avatarAsset, bio, displayName, goalCategory, setUser]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable
            style={[styles.saveHeaderButton, !canSave && styles.saveHeaderButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.saveHeaderText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarPicker} onPress={pickAvatar}>
              {avatarPreviewUri ? (
                <Image source={{ uri: avatarPreviewUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={32} color={Colors.textTertiary} />
                </View>
              )}
            </Pressable>

            <View style={styles.avatarCopy}>
              <Text style={styles.label}>Profile photo</Text>
              <Text style={styles.avatarHelpText}>
                Upload a square image. PNG, JPG, and WebP are supported.
              </Text>
              <Pressable onPress={pickAvatar}>
                <Text style={styles.avatarActionText}>
                  {avatarPreviewUri ? 'Change photo' : 'Add photo'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your display name"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              maxLength={50}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, 160))}
              placeholder="Tell people what you are working on"
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={160}
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>{bio.length}/160</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Focus area</Text>
            <View style={styles.categoryGrid}>
              {GOAL_CATEGORIES.map((category) => {
                const selected = goalCategory === category.id;
                return (
                  <Pressable
                    key={category.id}
                    style={[styles.categoryCard, selected && styles.categoryCardSelected]}
                    onPress={() => setGoalCategory(selected ? null : category.id)}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text
                      style={[styles.categoryText, selected && styles.categoryTextSelected]}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  headerButton: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.text,
  },
  saveHeaderButton: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  saveHeaderButtonDisabled: {
    opacity: 0.5,
  },
  saveHeaderText: {
    ...Typography.buttonSmall,
    color: Colors.primary,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  avatarPicker: {
    borderRadius: Layout.avatarSizeXl / 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: Layout.avatarSizeXl,
    height: Layout.avatarSizeXl,
    borderRadius: Layout.avatarSizeXl / 2,
  },
  avatarPlaceholder: {
    width: Layout.avatarSizeXl,
    height: Layout.avatarSizeXl,
    borderRadius: Layout.avatarSizeXl / 2,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  avatarHelpText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  avatarActionText: {
    ...Typography.buttonSmall,
    color: Colors.primary,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  input: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  bioInput: {
    minHeight: 120,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  categoryCard: {
    width: '47%',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  categoryCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryText: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  categoryTextSelected: {
    color: Colors.primary,
  },
});
