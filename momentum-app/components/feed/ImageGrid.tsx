import React from 'react';
import { View, Image, StyleSheet, Pressable, Dimensions } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import type { LogImage } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_WIDTH = SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2; // Screen padding + card padding
const GRID_GAP = 2;

interface ImageGridProps {
  images: LogImage[];
  onImagePress?: (index: number) => void;
}

/**
 * Renders 1-4 images in different grid layouts:
 * 1 image: full width
 * 2 images: side by side
 * 3 images: one large left, two stacked right
 * 4 images: 2x2 grid
 */
export function ImageGrid({ images, onImagePress }: ImageGridProps) {
  if (!images || images.length === 0) return null;

  const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const count = Math.min(sortedImages.length, 4);

  const handlePress = (index: number) => {
    onImagePress?.(index);
  };

  if (count === 1) {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => handlePress(0)} style={styles.singleImage}>
          <Image
            source={{ uri: sortedImages[0].public_url }}
            style={styles.singleImage}
            resizeMode="cover"
          />
        </Pressable>
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <Pressable
            onPress={() => handlePress(0)}
            style={[styles.halfImage, { marginRight: GRID_GAP / 2 }]}
          >
            <Image
              source={{ uri: sortedImages[0].public_url }}
              style={styles.fill}
              resizeMode="cover"
            />
          </Pressable>
          <Pressable
            onPress={() => handlePress(1)}
            style={[styles.halfImage, { marginLeft: GRID_GAP / 2 }]}
          >
            <Image
              source={{ uri: sortedImages[1].public_url }}
              style={styles.fill}
              resizeMode="cover"
            />
          </Pressable>
        </View>
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <Pressable
            onPress={() => handlePress(0)}
            style={[styles.twoThirdsImage, { marginRight: GRID_GAP / 2 }]}
          >
            <Image
              source={{ uri: sortedImages[0].public_url }}
              style={styles.fill}
              resizeMode="cover"
            />
          </Pressable>
          <View style={[styles.stackedColumn, { marginLeft: GRID_GAP / 2 }]}>
            <Pressable
              onPress={() => handlePress(1)}
              style={[styles.stackedImage, { marginBottom: GRID_GAP / 2 }]}
            >
              <Image
                source={{ uri: sortedImages[1].public_url }}
                style={styles.fill}
                resizeMode="cover"
              />
            </Pressable>
            <Pressable
              onPress={() => handlePress(2)}
              style={[styles.stackedImage, { marginTop: GRID_GAP / 2 }]}
            >
              <Image
                source={{ uri: sortedImages[2].public_url }}
                style={styles.fill}
                resizeMode="cover"
              />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // 4 images: 2x2 grid
  return (
    <View style={styles.container}>
      <View style={[styles.row, { marginBottom: GRID_GAP / 2 }]}>
        <Pressable
          onPress={() => handlePress(0)}
          style={[styles.quadImage, { marginRight: GRID_GAP / 2 }]}
        >
          <Image
            source={{ uri: sortedImages[0].public_url }}
            style={styles.fill}
            resizeMode="cover"
          />
        </Pressable>
        <Pressable
          onPress={() => handlePress(1)}
          style={[styles.quadImage, { marginLeft: GRID_GAP / 2 }]}
        >
          <Image
            source={{ uri: sortedImages[1].public_url }}
            style={styles.fill}
            resizeMode="cover"
          />
        </Pressable>
      </View>
      <View style={[styles.row, { marginTop: GRID_GAP / 2 }]}>
        <Pressable
          onPress={() => handlePress(2)}
          style={[styles.quadImage, { marginRight: GRID_GAP / 2 }]}
        >
          <Image
            source={{ uri: sortedImages[2].public_url }}
            style={styles.fill}
            resizeMode="cover"
          />
        </Pressable>
        <Pressable
          onPress={() => handlePress(3)}
          style={[styles.quadImage, { marginLeft: GRID_GAP / 2 }]}
        >
          <Image
            source={{ uri: sortedImages[3].public_url }}
            style={styles.fill}
            resizeMode="cover"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  singleImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  halfImage: {
    flex: 1,
    height: 180,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  twoThirdsImage: {
    flex: 2,
    height: 200,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  stackedColumn: {
    flex: 1,
  },
  stackedImage: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  quadImage: {
    flex: 1,
    height: 120,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
});
