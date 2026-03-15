import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserSearch } from '@/hooks/useSearch';
import FollowButton from './FollowButton';
import { colors, spacing, typography } from '@/constants/theme';
import type { User } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface UserSearchModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * "navigate" — tapping a user goes to their profile
   * "tag" — multi-select mode, returns selected user IDs
   */
  mode: 'navigate' | 'tag';
  /** Called in "tag" mode with the selected user IDs */
  onSelectUsers?: (userIds: string[]) => void;
  /** Pre-selected user IDs (for "tag" mode) */
  selectedUserIds?: string[];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UserSearchModal({
  visible,
  onClose,
  mode,
  onSelectUsers,
  selectedUserIds = [],
}: UserSearchModalProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedUserIds),
  );
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();
  const { data: users, isLoading } = useUserSearch(debouncedQuery);

  // Sync selected from props when modal opens
  useEffect(() => {
    if (visible) {
      setSelected(new Set(selectedUserIds));
      setQuery('');
      setDebouncedQuery('');
      // Focus the input after the modal animation
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible, selectedUserIds]);

  // Debounce the query
  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 300);
  }, []);

  // Navigate mode: tap to go to profile
  const handleUserTap = useCallback(
    (user: User) => {
      if (mode === 'navigate') {
        onClose();
        router.push(`/users/${user.username}`);
      }
    },
    [mode, onClose, router],
  );

  // Tag mode: toggle user selection
  const handleToggleSelect = useCallback((userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  // Confirm tag selection
  const handleConfirm = useCallback(() => {
    onSelectUsers?.(Array.from(selected));
    onClose();
  }, [selected, onSelectUsers, onClose]);

  const renderUser = useCallback(
    ({ item }: { item: User }) => {
      const isSelected = selected.has(item.id);

      return (
        <TouchableOpacity
          style={[styles.userRow, isSelected && styles.userRowSelected]}
          onPress={() => {
            if (mode === 'tag') {
              handleToggleSelect(item.id);
            } else {
              handleUserTap(item);
            }
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${item.display_name} @${item.username}`}
        >
          {/* Avatar */}
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color={colors.textTertiary} />
            </View>
          )}

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.displayName} numberOfLines={1}>
              {item.display_name}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>

          {/* Action */}
          {mode === 'tag' ? (
            <View
              style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected,
              ]}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={colors.background}
                />
              )}
            </View>
          ) : (
            <FollowButton
              username={item.username}
              initialIsFollowing={(item as any).is_following ?? false}
              compact
            />
          )}
        </TouchableOpacity>
      );
    },
    [mode, selected, handleToggleSelect, handleUserTap],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Close search"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {mode === 'tag' ? 'Tag Users' : 'Search Users'}
          </Text>

          {mode === 'tag' ? (
            <TouchableOpacity
              onPress={handleConfirm}
              accessibilityLabel="Confirm selection"
              accessibilityRole="button"
            >
              <Text style={styles.doneText}>
                Done{selected.size > 0 ? ` (${selected.size})` : ''}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search by name or username..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search users"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setDebouncedQuery('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {isLoading && debouncedQuery.length >= 2 ? (
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : debouncedQuery.length < 2 ? (
          <View style={styles.centeredContainer}>
            <Ionicons name="search" size={48} color={colors.border} />
            <Text style={styles.emptyText}>
              Type at least 2 characters to search
            </Text>
          </View>
        ) : users && users.length === 0 ? (
          <View style={styles.centeredContainer}>
            <Ionicons
              name="person-outline"
              size={48}
              color={colors.border}
            />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          <FlatList
            data={users ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '700',
  },
  doneText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  userRowSelected: {
    backgroundColor: colors.primaryLight ?? '#E8F0FE',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  username: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
