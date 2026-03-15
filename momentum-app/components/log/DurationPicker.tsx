import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
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

  const hourItems = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => (
        <Picker.Item key={i} label={`${i}`} value={i} />
      )),
    [],
  );

  const minuteItems = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => (
        <Picker.Item key={i} label={i.toString().padStart(2, '0')} value={i} />
      )),
    [],
  );

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

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.pickerRow}>
        <View style={styles.pickerColumn}>
          <Text style={styles.pickerLabel}>Hours</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={hours}
              onValueChange={handleHourChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {hourItems}
            </Picker>
          </View>
        </View>

        <Text style={styles.separator}>:</Text>

        <View style={styles.pickerColumn}>
          <Text style={styles.pickerLabel}>Minutes</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={minutes}
              onValueChange={handleMinuteChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {minuteItems}
            </Picker>
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
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 150 : 50,
  },
  pickerItem: {
    fontSize: 20,
    color: colors.text,
  },
  separator: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.sm,
    marginTop: 20,
  },
});
