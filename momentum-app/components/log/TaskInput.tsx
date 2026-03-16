import React, { useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DurationPicker from './DurationPicker';
import { useCategories } from '@/hooks/useLog';
import { colors, spacing, typography } from '@/constants/theme';
import type { Category } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TaskData {
  task_name: string;
  category_id: string;
  duration: number; // seconds
  sort_order: number;
}

interface TaskInputProps {
  task: TaskData;
  index: number;
  totalTasks: number;
  onChange: (index: number, task: TaskData) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TaskInput({
  task,
  index,
  totalTasks,
  onChange,
  onRemove,
  onAdd,
}: TaskInputProps) {
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const updateField = useCallback(
    <K extends keyof TaskData>(field: K, value: TaskData[K]) => {
      onChange(index, { ...task, [field]: value });
    },
    [index, task, onChange],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.taskLabel}>Task {index + 1}</Text>
        {totalTasks > 1 && (
          <TouchableOpacity
            onPress={() => onRemove(index)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Remove task ${index + 1}`}
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={22} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Task Name */}
      <TextInput
        style={styles.nameInput}
        placeholder="What did you work on?"
        placeholderTextColor={colors.textTertiary}
        value={task.task_name}
        onChangeText={(text) => updateField('task_name', text)}
        maxLength={100}
        returnKeyType="done"
        accessibilityLabel="Task name"
      />

      {/* Category Picker */}
      <View style={styles.categoryWrapper}>
        <Text style={styles.fieldLabel}>Category</Text>
        {categoriesLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.pickerContainer}>
            {Platform.OS === 'web' ? (
              // Web: use native <select> via a hidden approach
              <View style={styles.categoryPicker}>
                <select
                  value={task.category_id}
                  onChange={(e: any) => updateField('category_id', e.target.value)}
                  aria-label={`Task ${index + 1} category`}
                  style={{
                    width: '100%',
                    height: 40,
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: 14,
                    color: task.category_id ? colors.text : colors.textTertiary,
                    outline: 'none',
                  } as any}
                >
                  <option value="">Select category...</option>
                  {categories?.map((cat: Category) => (
                    <option key={cat.id} value={cat.id}>
                      {`${cat.icon ?? ''} ${cat.name}`.trim()}
                    </option>
                  ))}
                </select>
              </View>
            ) : (
              // Native: simple touchable category buttons
              <View style={styles.categoryList}>
                {categories?.map((cat: Category) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      task.category_id === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => updateField('category_id', cat.id)}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      task.category_id === cat.id && styles.categoryChipTextActive,
                    ]}>
                      {cat.icon ?? ''} {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Duration Picker */}
      <DurationPicker
        label="Duration"
        value={task.duration}
        onChange={(seconds) => updateField('duration', seconds)}
      />

      {/* Add Another Task button — only shown on the last task */}
      {index === totalTasks - 1 && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAdd}
          accessibilityLabel="Add another task"
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addButtonText}>Add another task</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  taskLabel: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '600',
  },
  nameInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryWrapper: {
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  categoryPicker: {
    width: '100%',
    color: colors.text,
    paddingHorizontal: spacing.xs,
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primaryLight ?? '#E8F0FE',
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  addButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});
