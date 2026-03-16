import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Conditionally import BottomSheet — on web we use a Modal fallback
let BottomSheet: any = null;
let BottomSheetScrollView: any = ScrollView;
if (Platform.OS !== 'web') {
  try {
    const bs = require('@gorhom/bottom-sheet');
    BottomSheet = bs.default;
    BottomSheetScrollView = bs.BottomSheetScrollView;
  } catch {}
}
import TaskInput, { type TaskData } from './TaskInput';
import ImagePickerComponent from './ImagePicker';
import UserSearchModal from '@/components/common/UserSearchModal';
import { useCreateLog, type CreateLogPayload } from '@/hooks/useLog';
import { startStopwatch } from '@/lib/stopwatch';
import { type ImageAsset } from '@/lib/imageUpload';
import { colors, spacing, typography } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface LogSheetProps {
  /** Ref to control the bottom sheet from parent */
  bottomSheetRef?: React.RefObject<any>;
  /** Pre-filled duration from stopwatch (in seconds) */
  prefillDuration?: number;
  /** Pre-filled start/end timestamps from stopwatch */
  prefillStartedAt?: string;
  prefillEndedAt?: string;
  /** Called when activity mode is started (parent should show banner) */
  onStartActivity?: () => void;
  /** Called after successful log creation */
  onSuccess?: () => void;
  /** Called when the sheet should close (required on web) */
  onClose?: () => void;
}

const NOTE_MAX_LENGTH = 280;

const createEmptyTask = (sortOrder: number): TaskData => ({
  task_name: '',
  category_id: '',
  duration: 0,
  sort_order: sortOrder,
});

// ── Component ────────────────────────────────────────────────────────────────

export default function LogSheet({
  bottomSheetRef,
  prefillDuration,
  prefillStartedAt,
  prefillEndedAt,
  onStartActivity,
  onSuccess,
  onClose,
}: LogSheetProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState<TaskData[]>([createEmptyTask(0)]);
  const [note, setNote] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);

  // Mutation
  const createLog = useCreateLog();

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['90%'], []);

  // ── Task Handlers ────────────────────────────────────────────────────────

  const handleTaskChange = useCallback(
    (index: number, updatedTask: TaskData) => {
      setTasks((prev) => {
        const next = [...prev];
        next[index] = updatedTask;
        return next;
      });
    },
    [],
  );

  const handleAddTask = useCallback(() => {
    setTasks((prev) => [...prev, createEmptyTask(prev.length)]);
  }, []);

  const handleRemoveTask = useCallback((index: number) => {
    setTasks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Re-index sort_order
      return next.map((t, i) => ({ ...t, sort_order: i }));
    });
  }, []);

  // ── Image Handlers ───────────────────────────────────────────────────────

  const handleImagesChange = useCallback((newImages: ImageAsset[]) => {
    setImages(newImages);
  }, []);

  const handleImageIdsReady = useCallback((ids: string[]) => {
    setImageIds(ids);
  }, []);

  // ── Tag Handlers ─────────────────────────────────────────────────────────

  const handleTagUsers = useCallback((userIds: string[]) => {
    setTaggedUserIds(userIds);
    setShowTagModal(false);
  }, []);

  // ── Start Activity (Stopwatch) ───────────────────────────────────────────

  const handleStartActivity = useCallback(async () => {
    await startStopwatch();
    bottomSheetRef.current?.close();
    onStartActivity?.();
  }, [bottomSheetRef, onStartActivity]);

  // ── Form Reset ───────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setTitle('');
    setTasks([createEmptyTask(0)]);
    setNote('');
    setIsPublished(false);
    setImages([]);
    setImageIds([]);
    setTaggedUserIds([]);
  }, []);

  // ── Form Validation ──────────────────────────────────────────────────────

  const validate = useCallback((): string | null => {
    if (!title.trim()) return 'Please enter a title for your session.';

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t.task_name.trim()) return `Please enter a name for task ${i + 1}.`;
      if (!t.category_id) return `Please select a category for task ${i + 1}.`;
      if (t.duration <= 0 && !prefillDuration)
        return `Please set a duration for task ${i + 1}.`;
    }

    return null;
  }, [title, tasks, prefillDuration]);

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const error = validate();
    if (error) {
      Alert.alert('Missing info', error);
      return;
    }

    // If a prefilled duration exists (from stopwatch) and tasks have 0 duration,
    // distribute it evenly across tasks
    const finalTasks = tasks.map((t, i) => {
      let duration = t.duration;
      if (duration === 0 && prefillDuration) {
        duration = Math.floor(prefillDuration / tasks.length);
      }
      return {
        task_name: t.task_name.trim(),
        category_id: t.category_id,
        duration,
        sort_order: i,
      };
    });

    const payload: CreateLogPayload = {
      title: title.trim(),
      is_published: isPublished,
      tasks: finalTasks,
    };

    if (note.trim()) payload.note = note.trim();
    if (prefillStartedAt) payload.started_at = prefillStartedAt;
    if (prefillEndedAt) payload.ended_at = prefillEndedAt;
    if (taggedUserIds.length > 0) payload.tagged_user_ids = taggedUserIds;
    if (imageIds.length > 0) payload.image_ids = imageIds;

    try {
      await createLog.mutateAsync(payload);
      resetForm();
      bottomSheetRef.current?.close();
      onSuccess?.();
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ??
        'Something went wrong. Please try again.';
      Alert.alert('Error', message);
    }
  }, [
    validate,
    tasks,
    title,
    note,
    isPublished,
    prefillDuration,
    prefillStartedAt,
    prefillEndedAt,
    taggedUserIds,
    imageIds,
    createLog,
    resetForm,
    bottomSheetRef,
    onSuccess,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {Platform.OS === 'web' ? (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={onClose}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <View style={styles.modalContent}>
              <View style={styles.modalHandle}>
                <View style={styles.handleIndicator} />
                <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
          {/* Header */}
          <Text style={styles.sheetTitle}>Log a Session</Text>

          {/* Title Input */}
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="What session is this?"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            returnKeyType="next"
            accessibilityLabel="Session title"
          />

          {/* Tasks */}
          <Text style={styles.sectionLabel}>Tasks</Text>
          {tasks.map((task, index) => (
            <TaskInput
              key={index}
              task={task}
              index={index}
              totalTasks={tasks.length}
              onChange={handleTaskChange}
              onRemove={handleRemoveTask}
              onAdd={handleAddTask}
            />
          ))}

          {/* Note */}
          <Text style={styles.fieldLabel}>Reflection (optional)</Text>
          <View style={styles.noteContainer}>
            <TextInput
              style={styles.noteInput}
              placeholder="How did it go?"
              placeholderTextColor={colors.textTertiary}
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX_LENGTH}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel="Reflection note"
            />
            <Text
              style={[
                styles.charCounter,
                note.length > NOTE_MAX_LENGTH - 20 && styles.charCounterWarning,
              ]}
            >
              {note.length}/{NOTE_MAX_LENGTH}
            </Text>
          </View>

          {/* Image Picker */}
          <ImagePickerComponent
            images={images}
            onImagesChange={handleImagesChange}
            onImageIdsReady={handleImageIdsReady}
            maxImages={4}
          />

          {/* Tag Users */}
          <TouchableOpacity
            style={styles.tagButton}
            onPress={() => setShowTagModal(true)}
            accessibilityLabel="Tag users"
            accessibilityRole="button"
          >
            <Ionicons
              name="people-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.tagButtonText}>
              {taggedUserIds.length > 0
                ? `${taggedUserIds.length} user${taggedUserIds.length > 1 ? 's' : ''} tagged`
                : 'Tag users'}
            </Text>
          </TouchableOpacity>

          {/* Share Toggle */}
          <View style={styles.shareRow}>
            <View style={styles.shareTextWrapper}>
              <Text style={styles.shareLabel}>Share to feed</Text>
              <Text style={styles.shareHint}>
                Make this session visible to your followers
              </Text>
            </View>
            <Switch
              value={isPublished}
              onValueChange={setIsPublished}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.background}
              accessibilityLabel="Share to feed toggle"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.activityButton}
              onPress={handleStartActivity}
              accessibilityLabel="Start activity timer"
              accessibilityRole="button"
            >
              <Ionicons
                name="timer-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.activityButtonText}>Start Activity</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                createLog.isPending && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={createLog.isPending}
              accessibilityLabel="Log session"
              accessibilityRole="button"
            >
              {createLog.isPending ? (
                <Text style={styles.submitButtonText}>Saving...</Text>
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.background}
                  />
                  <Text style={styles.submitButtonText}>Log It</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
            </View>
          </View>
        </Modal>
      ) : BottomSheet ? (
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.handleIndicator}
          onClose={onClose}
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <Text style={styles.sheetTitle}>Log a Session</Text>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="What session is this?"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              returnKeyType="next"
            />
            <Text style={styles.submitButtonText}>Use the web version for full form</Text>
          </BottomSheetScrollView>
        </BottomSheet>
      ) : null}

      {/* Tag Users Modal */}
      <UserSearchModal
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        mode="tag"
        onSelectUsers={handleTagUsers}
        selectedUserIds={taggedUserIds}
      />
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  modalHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    position: 'relative',
    zIndex: 2,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.sm,
    zIndex: 3,
  },
  sheetBackground: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: colors.border,
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 40,
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  sectionLabel: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  titleInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  noteContainer: {
    position: 'relative',
  },
  noteInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    fontSize: 14,
  },
  charCounter: {
    ...typography.caption,
    color: colors.textTertiary,
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  charCounterWarning: {
    color: colors.error,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tagButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  shareTextWrapper: {
    flex: 1,
    marginRight: spacing.md,
  },
  shareLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  shareHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  activityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  activityButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: spacing.xs,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
  },
});
