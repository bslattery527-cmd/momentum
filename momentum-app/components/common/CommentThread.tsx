import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useComments, usePostComment, useDeleteComment } from '@/hooks/useComments';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/constants/theme';
import type { Comment } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface CommentThreadProps {
  logId: string;
  /** The user ID of the log owner (for delete permissions) */
  logOwnerId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CommentThread({
  logId,
  logOwnerId,
}: CommentThreadProps) {
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const user = useAuthStore((s) => s.user);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useComments(logId);

  const postComment = usePostComment();
  const deleteComment = useDeleteComment();

  // Flatten paginated data
  const comments = data?.pages.flatMap((page) => page.data) ?? [];

  const handlePost = useCallback(() => {
    const body = commentText.trim();
    if (!body) return;
    if (body.length > 500) {
      Alert.alert('Too long', 'Comments must be 500 characters or fewer.');
      return;
    }

    setCommentText('');
    inputRef.current?.blur();

    postComment.mutate(
      { logId, body },
      {
        onError: (err: any) => {
          const message =
            err?.response?.data?.error?.message ?? 'Failed to post comment.';
          Alert.alert('Error', message);
          // Restore the text so the user can retry
          setCommentText(body);
        },
      },
    );
  }, [commentText, logId, postComment]);

  const handleDelete = useCallback(
    (commentId: string) => {
      Alert.alert('Delete comment', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteComment.mutate({ commentId, logId });
          },
        },
      ]);
    },
    [logId, deleteComment],
  );

  const canDelete = useCallback(
    (comment: Comment) => {
      if (!user) return false;
      // Comment author or log owner can delete
      return comment.user.id === user.id || logOwnerId === user.id;
    },
    [user, logOwnerId],
  );

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => {
      const commentUser = item.user;
      return (
        <View style={styles.commentRow}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {commentUser?.avatar_url ? (
              <Image
                source={{ uri: commentUser.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons
                  name="person"
                  size={16}
                  color={colors.textTertiary}
                />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentUsername}>
                {commentUser?.username ?? 'Unknown'}
              </Text>
              <Text style={styles.commentTime}>
                {timeAgo(item.created_at)}
              </Text>
            </View>
            <Text style={styles.commentBody}>{item.body}</Text>
          </View>

          {/* Delete */}
          {canDelete(item) && (
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Delete comment"
              accessibilityRole="button"
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [canDelete, handleDelete],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <ActivityIndicator
        style={styles.loadingMore}
        size="small"
        color={colors.primary}
      />
    );
  }, [isFetchingNextPage]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {/* Comment List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No comments yet. Be the first!
          </Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          contentContainerStyle={styles.listContent}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
        />
      )}

      {/* Comment Input */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Write a comment..."
          placeholderTextColor={colors.textTertiary}
          value={commentText}
          onChangeText={setCommentText}
          maxLength={500}
          multiline
          returnKeyType="send"
          onSubmitEditing={handlePost}
          blurOnSubmit
          accessibilityLabel="Comment input"
        />
        <TouchableOpacity
          style={[
            styles.postButton,
            !commentText.trim() && styles.postButtonDisabled,
          ]}
          onPress={handlePost}
          disabled={!commentText.trim() || postComment.isPending}
          accessibilityLabel="Post comment"
          accessibilityRole="button"
        >
          {postComment.isPending ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Ionicons name="send" size={18} color={colors.background} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  avatarWrapper: {},
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  commentUsername: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  commentTime: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 11,
  },
  commentBody: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingMore: {
    paddingVertical: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    maxHeight: 100,
    fontSize: 14,
  },
  postButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: colors.border,
  },
});
