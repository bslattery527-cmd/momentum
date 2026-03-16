import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface DurationPickerProps {
  /** Current total seconds */
  value: number;
  /** Called with the new total seconds */
  onChange: (totalSeconds: number) => void;
  /** Optional label shown above the picker */
  label?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DurationPicker({
  value,
  onChange,
  label,
}: DurationPickerProps) {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  const handleHourChange = useCallback(
    (newHours: number) => {
      onChange(newHours * 3600 + minutes * 60);
    },
    [minutes, onChange],
  );

  const handleMinuteChange = useCallback(
    (newMinutes: number) => {
      onChange(hours * 3600 + newMinutes * 60);
    },
    [hours, onChange],
  );

  const adjustHours = useCallback(
    (delta: number) => {
      handleHourChange(Math.max(0, Math.min(23, hours + delta)));
    },
    [handleHourChange, hours],
  );

  const adjustMinutes = useCallback(
    (delta: number) => {
      handleMinuteChange(Math.max(0, Math.min(59, minutes + delta)));
    },
    [handleMinuteChange, minutes],
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.pickerRow}>
        <View style={styles.pickerColumn}>
          <Text style={styles.pickerLabel}>Hours</Text>
          <View style={styles.pickerWrapper}>
            {Platform.OS === 'web' ? (
              <select
                value={hours}
                onChange={(e: any) => handleHourChange(Number(e.target.value))}
                aria-label={label ? `${label} hours` : 'Hours'}
                style={{
                  width: '100%',
                  height: 44,
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: 18,
                  textAlign: 'center',
                  color: colors.text,
                  outline: 'none',
                } as any}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            ) : (
              <View style={styles.nativePickerRow}>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => adjustHours(-1)}
                  accessibilityLabel={label ? `${label} hours down` : 'Hours down'}
                >
                  <Text style={styles.stepButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.nativeValue}>{hours}</Text>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => adjustHours(1)}
                  accessibilityLabel={label ? `${label} hours up` : 'Hours up'}
                >
                  <Text style={styles.stepButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.separator}>:</Text>

        <View style={styles.pickerColumn}>
          <Text style={styles.pickerLabel}>Minutes</Text>
          <View style={styles.pickerWrapper}>
            {Platform.OS === 'web' ? (
              <select
                value={minutes}
                onChange={(e: any) => handleMinuteChange(Number(e.target.value))}
                aria-label={label ? `${label} minutes` : 'Minutes'}
                style={{
                  width: '100%',
                  height: 44,
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: 18,
                  textAlign: 'center',
                  color: colors.text,
                  outline: 'none',
                } as any}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                ))}
              </select>
            ) : (
              <View style={styles.nativePickerRow}>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => adjustMinutes(-5)}
                  accessibilityLabel={label ? `${label} minutes down` : 'Minutes down'}
                >
                  <Text style={styles.stepButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.nativeValue}>{minutes.toString().padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => adjustMinutes(5)}
                  accessibilityLabel={label ? `${label} minutes up` : 'Minutes up'}
                >
                  <Text style={styles.stepButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  pickerWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  nativePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  stepButtonText: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: '700',
  },
  nativeValue: {
    ...typography.subtitle,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.sm,
    marginTop: 20,
  },
});
