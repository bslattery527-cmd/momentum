import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadImages, type ImageAsset, type UploadProgress } from '@/lib/imageUpload';
import { colors, spacing, typography } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface ImagePickerProps {
  /** Currently selected image URIs (local or remote) for preview */
  images: ImageAsset[];
  /** Called when images change — provides both assets and uploaded IDs */
  onImagesChange: (images: ImageAsset[]) => void;
  /** Called with image IDs after successful upload to S3 */
  onImageIdsReady: (imageIds: string[]) => void;
  /** Maximum number of images (default 4) */
  maxImages?: number;
  /** Disable when offline */
  disabled?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ImagePickerComponent({
  images,
  onImagesChange,
  onImageIdsReady,
  maxImages = 4,
  disabled = false,
}: ImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );

  const pickImages = useCallback(async () => {
    if (disabled) {
      Alert.alert(
        'Offline',
        'Connect to the internet to add images.',
      );
      return;
    }

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', `Maximum ${maxImages} images allowed.`);
      return;
    }

    // Request permission
    const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please grant photo library access in Settings to add images.',
      );
      return;
    }

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      exif: false,
    });

    if (result.canceled || result.assets.length === 0) return;

    const newAssets: ImageAsset[] = result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileSize: asset.fileSize ?? 0,
    }));

    const combined = [...images, ...newAssets].slice(0, maxImages);
    onImagesChange(combined);

    // Start uploading immediately
    setUploading(true);
    setUploadProgress(null);

    try {
      const imageIds = await uploadImages(combined, (progress) => {
        setUploadProgress(progress);
      });
      onImageIdsReady(imageIds);
    } catch (err: any) {
      Alert.alert(
        'Upload failed',
        err.message || 'Failed to upload images. Please try again.',
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [disabled, images, maxImages, onImagesChange, onImageIdsReady]);

  const removeImage = useCallback(
    (index: number) => {
      const updated = images.filter((_, i) => i !== index);
      onImagesChange(updated);
      // Note: We cannot "un-upload" from S3, but the image_ids won't be sent
      // with the log creation if the user removes the image before submitting.
      // The nightly cleanup job handles orphaned uploads.
    },
    [images, onImagesChange],
  );

  const overallProgress = uploadProgress
    ? ((uploadProgress.index + uploadProgress.fraction) / images.length) * 100
    : 0;

  return (
    <View style={styles.container}>
      {/* Thumbnail Grid */}
      {images.length > 0 && (
        <View style={styles.thumbnailGrid}>
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.thumbnailWrapper}>
              <Image
                source={{ uri: image.uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={`Remove image ${index + 1}`}
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Upload Progress */}
      {uploading && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.progressText}>
            Uploading... {Math.round(overallProgress)}%
          </Text>
          <View style={styles.progressBarBackground}>
            <View
              style={[styles.progressBarFill, { width: `${overallProgress}%` }]}
            />
          </View>
        </View>
      )}

      {/* Add Images Button */}
      {images.length < maxImages && !uploading && (
        <TouchableOpacity
          style={[styles.addButton, disabled && styles.addButtonDisabled]}
          onPress={pickImages}
          disabled={disabled}
          accessibilityLabel="Add images"
          accessibilityRole="button"
        >
          <Ionicons
            name="camera-outline"
            size={24}
            color={disabled ? colors.textTertiary : colors.primary}
          />
          <Text
            style={[
              styles.addButtonText,
              disabled && styles.addButtonTextDisabled,
            ]}
          >
            Add photos ({images.length}/{maxImages})
          </Text>
        </TouchableOpacity>
      )}

      {disabled && images.length < maxImages && (
        <Text style={styles.offlineHint}>
          Image upload requires an internet connection
        </Text>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'visible',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: 11,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  progressText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    minWidth: 100,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addButtonDisabled: {
    borderColor: colors.border,
  },
  addButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
  addButtonTextDisabled: {
    color: colors.textTertiary,
  },
  offlineHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
