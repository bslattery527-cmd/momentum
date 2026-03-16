import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useCreateGoal } from '@/hooks/useGoals';

interface GoalModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function GoalModal({ visible, onClose }: GoalModalProps) {
  const [type, setType] = useState<'days' | 'hours'>('days');
  const [target, setTarget] = useState('5');
  const createGoal = useCreateGoal();

  const numericTarget = useMemo(() => Number.parseInt(target, 10), [target]);

  const handleClose = useCallback(() => {
    if (createGoal.isPending) return;
    onClose();
  }, [createGoal.isPending, onClose]);

  const handleSave = useCallback(async () => {
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      Alert.alert('Invalid goal', 'Please enter a target greater than 0.');
      return;
    }

    try {
      await createGoal.mutateAsync({ type, target: numericTarget });
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ??
        'Could not create your weekly goal. Please try again.';
      Alert.alert('Error', message);
    }
  }, [createGoal, numericTarget, onClose, type]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Set a weekly goal</Text>
          <Text style={styles.subtitle}>
            Choose what you want to stay consistent with this week.
          </Text>

          <View style={styles.typeRow}>
            <Pressable
              style={[styles.typeButton, type === 'days' && styles.typeButtonActive]}
              onPress={() => setType('days')}
            >
              <Text
                style={[styles.typeButtonText, type === 'days' && styles.typeButtonTextActive]}
              >
                Days
              </Text>
            </Pressable>
            <Pressable
              style={[styles.typeButton, type === 'hours' && styles.typeButtonActive]}
              onPress={() => setType('hours')}
            >
              <Text
                style={[styles.typeButtonText, type === 'hours' && styles.typeButtonTextActive]}
              >
                Hours
              </Text>
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>
            {type === 'days' ? 'How many days this week?' : 'How many hours this week?'}
          </Text>
          <TextInput
            style={styles.input}
            value={target}
            onChangeText={(text) => setTarget(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={type === 'days' ? '5' : '8'}
            placeholderTextColor={Colors.textTertiary}
            maxLength={2}
          />

          <View style={styles.actionRow}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, createGoal.isPending && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={createGoal.isPending}
            >
              {createGoal.isPending ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Save goal</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  typeButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  typeButtonText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  typeButtonTextActive: {
    color: Colors.primary,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  input: {
    ...Typography.body,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  cancelButtonText: {
    ...Typography.buttonSmall,
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...Typography.buttonSmall,
    color: Colors.textInverse,
  },
});
