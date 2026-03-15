import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Layout,
} from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { UpdateUserPayload, User } from '@/types';

const STEPS = ['name', 'avatar', 'bio', 'category'] as const;
type Step = (typeof STEPS)[number];

const GOAL_CATEGORIES = [
  { id: 'reading', label: 'Reading', icon: '📚' },
  { id: 'coding', label: 'Coding', icon: '💻' },
  { id: 'writing', label: 'Writing', icon: '✍️' },
  { id: 'study', label: 'Study', icon: '🎓' },
  { id: 'creative', label: 'Creative', icon: '🎨' },
  { id: 'other', label: 'Other', icon: '⚡' },
];

export default function OnboardingScreen() {
  const { user, setUser, setOnboardingComplete } = useAuthStore();

  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = STEPS[stepIndex];
  const progress = (stepIndex + 1) / STEPS.length;

  // ─── Avatar Picker ──────────────────────────────────────────────────────

  const pickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please grant photo library access to set your avatar.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  // ─── Upload Avatar to S3 ───────────────────────────────────────────────

  const uploadAvatar = useCallback(async (): Promise<string | null> => {
    if (!avatarUri) return null;

    try {
      // Fetch the image blob to determine file size
      const imageBlob = await fetch(avatarUri);
      const blob = await imageBlob.blob();

      // Get pre-signed URL from the API (requires mime_type and file_size)
      const uploadResponse = await api.post('/users/me/avatar-upload', {
        mime_type: 'image/jpeg',
        file_size: blob.size,
      });
      const { upload_url, public_url } = uploadResponse.data as {
        upload_url: string;
        public_url: string;
      };

      // Upload to S3
      await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      return public_url;
    } catch {
      // Avatar upload is optional — don't block onboarding
      return null;
    }
  }, [avatarUri]);

  // ─── Save Profile ─────────────────────────────────────────────────────

  const saveProfile = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const payload: UpdateUserPayload = {};

      if (displayName.trim()) {
        payload.display_name = displayName.trim();
      }

      if (bio.trim()) {
        payload.bio = bio.trim();
      }

      if (selectedCategory) {
        payload.goal_category = selectedCategory;
      }

      // Upload avatar if selected
      if (avatarUri) {
        const avatarUrl = await uploadAvatar();
        if (avatarUrl) {
          payload.avatar_url = avatarUrl;
        }
      }

      const response = await api.put('/users/me', payload);
      const updatedUser = response.data as User;
      setUser(updatedUser);
      setOnboardingComplete();
    } catch (error) {
      Alert.alert(
        'Save failed',
        'Could not save your profile. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [displayName, bio, selectedCategory, avatarUri, uploadAvatar, setUser, setOnboardingComplete]);

  // ─── Navigation ──────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      saveProfile();
    }
  }, [stepIndex, saveProfile]);

  const handleSkip = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      saveProfile();
    }
  }, [stepIndex, saveProfile]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }, [stepIndex]);

  const canProceed = (() => {
    switch (currentStep) {
      case 'name':
        return displayName.trim().length >= 2;
      case 'avatar':
        return true; // optional
      case 'bio':
        return true; // optional
      case 'category':
        return true; // optional
    }
  })();

  const isOptionalStep = currentStep !== 'name';

  // ─── Render Step Content ──────────────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {
      case 'name':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What should we call you?</Text>
            <Text style={styles.stepSubtitle}>
              This is how you'll appear to others on Momentum
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Your display name"
                placeholderTextColor={Colors.textTertiary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoFocus
                maxLength={50}
              />
            </View>
          </View>
        );

      case 'avatar':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add a profile photo</Text>
            <Text style={styles.stepSubtitle}>
              Help others recognize you in the feed
            </Text>
            <Pressable onPress={pickAvatar} style={styles.avatarPicker}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={32} color={Colors.textTertiary} />
                  <Text style={styles.avatarPlaceholderText}>Add photo</Text>
                </View>
              )}
            </Pressable>
            {avatarUri && (
              <Pressable onPress={pickAvatar} style={styles.changePhotoButton}>
                <Text style={styles.changePhotoText}>Change photo</Text>
              </Pressable>
            )}
          </View>
        );

      case 'bio':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            <Text style={styles.stepSubtitle}>
              A short bio so others know what you're working on
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Building the future, one session at a time..."
                placeholderTextColor={Colors.textTertiary}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 160))}
                multiline
                maxLength={160}
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.charCount}>{bio.length}/160</Text>
          </View>
        );

      case 'category':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What do you work on?</Text>
            <Text style={styles.stepSubtitle}>
              Pick a category to personalize your experience
            </Text>
            <View style={styles.categoryGrid}>
              {GOAL_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    selectedCategory === cat.id && styles.categoryCardSelected,
                  ]}
                  onPress={() =>
                    setSelectedCategory(
                      selectedCategory === cat.id ? null : cat.id
                    )
                  }
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      selectedCategory === cat.id &&
                        styles.categoryLabelSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* ─── Progress Bar ────────────────────────────────── */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {stepIndex + 1} of {STEPS.length}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Back Button ──────────────────────────────── */}
          {stepIndex > 0 && (
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
          )}

          {renderStepContent()}
        </ScrollView>

        {/* ─── Bottom Actions ──────────────────────────────── */}
        <View style={styles.bottomActions}>
          {isOptionalStep && (
            <Pressable
              onPress={handleSkip}
              style={styles.skipButton}
              disabled={isSubmitting}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}

          <Pressable
            style={[
              styles.nextButton,
              !canProceed && styles.nextButtonDisabled,
              isOptionalStep && styles.nextButtonWithSkip,
            ]}
            onPress={handleNext}
            disabled={!canProceed || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.nextButtonText}>
                {stepIndex === STEPS.length - 1 ? 'Get started' : 'Continue'}
              </Text>
            )}
          </Pressable>
        </View>
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
  scrollContent: {
    paddingHorizontal: Spacing['3xl'],
    flexGrow: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    minWidth: 40,
    textAlign: 'right',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  stepContent: {
    flex: 1,
    paddingTop: Spacing['3xl'],
  },
  stepTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing['3xl'],
  },
  inputContainer: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
  },
  input: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.text,
  },
  bioInput: {
    height: 120,
    paddingTop: Spacing.md,
  },
  charCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  avatarPicker: {
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  avatarImage: {
    width: Layout.avatarSizeXl * 1.5,
    height: Layout.avatarSizeXl * 1.5,
    borderRadius: (Layout.avatarSizeXl * 1.5) / 2,
  },
  avatarPlaceholder: {
    width: Layout.avatarSizeXl * 1.5,
    height: Layout.avatarSizeXl * 1.5,
    borderRadius: (Layout.avatarSizeXl * 1.5) / 2,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  avatarPlaceholderText: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  changePhotoButton: {
    alignSelf: 'center',
  },
  changePhotoText: {
    ...Typography.bodyMedium,
    color: Colors.primary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  categoryCard: {
    width: '47%',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: Spacing.sm,
  },
  categoryLabel: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  categoryLabelSelected: {
    color: Colors.primary,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing['3xl'],
    paddingBottom: Spacing['3xl'],
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  skipButton: {
    height: 52,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  skipText: {
    ...Typography.button,
    color: Colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonWithSkip: {},
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
