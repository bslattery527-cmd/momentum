import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useToggleReaction } from '@/hooks/useReactions';
import { colors, spacing, typography } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface ReactionButtonProps {
  logId: string;
  initialCount: number;
  initialHasReacted: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ReactionButton({
  logId,
  initialCount,
  initialHasReacted,
}: ReactionButtonProps) {
  const [hasReacted, setHasReacted] = useState(initialHasReacted);
  const [count, setCount] = useState(initialCount);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;
  // Burst particles
  const burstAnims = useRef(
    Array.from({ length: 6 }, () => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
    }))
  ).current;

  const toggleReaction = useToggleReaction();

  // Sync with prop changes (e.g., when feed data refreshes)
  useEffect(() => {
    setHasReacted(initialHasReacted);
    setCount(initialCount);
  }, [initialHasReacted, initialCount]);

  const runClapAnimation = useCallback(() => {
    // Reset
    rotateAnim.setValue(0);
    highlightAnim.setValue(0);

    Animated.parallel([
      // Scale: pop up then settle
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.5,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]),
      // Rotate: small tilt
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -0.5,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      // Background highlight flash
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]),
      // Burst particles
      ...burstAnims.map((anim, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const distance = 18;
        return Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: Math.cos(angle) * distance,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: Math.sin(angle) * distance,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(150),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
        ]);
      }),
    ]).start(() => {
      // Reset burst particles
      burstAnims.forEach((anim) => {
        anim.scale.setValue(0);
        anim.opacity.setValue(0);
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
      });
    });
  }, [scaleAnim, rotateAnim, highlightAnim, burstAnims]);

  const handlePress = useCallback(() => {
    const prevReacted = hasReacted;
    const prevCount = count;

    setHasReacted(!prevReacted);
    setCount(prevReacted ? Math.max(0, prevCount - 1) : prevCount + 1);

    // Only play full animation when celebrating (not un-celebrating)
    if (!prevReacted) {
      runClapAnimation();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();
      });
    }

    toggleReaction.mutate(
      { logId, hasReacted: prevReacted },
      {
        onError: () => {
          setHasReacted(prevReacted);
          setCount(prevCount);
        },
      },
    );
  }, [hasReacted, count, logId, toggleReaction, scaleAnim, runClapAnimation]);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const highlightBg = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      hasReacted ? (colors.primaryLight ?? '#E8F0FE') : colors.surface,
      colors.primaryLight ?? '#E8F0FE',
    ],
  });

  return (
    <Animated.View style={{ backgroundColor: highlightBg, borderRadius: 20 }}>
      <TouchableOpacity
        style={[styles.container, hasReacted && styles.containerActive]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityLabel={
          hasReacted
            ? `Remove celebration. ${count} celebrations`
            : `Celebrate. ${count} celebrations`
        }
        accessibilityRole="button"
      >
        <View style={styles.emojiWrapper}>
          {/* Burst particles */}
          {burstAnims.map((anim, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.burstParticle,
                {
                  opacity: anim.opacity,
                  transform: [
                    { translateX: anim.translateX },
                    { translateY: anim.translateY },
                    { scale: anim.scale },
                  ],
                },
              ]}
            >
              {i % 2 === 0 ? '\u2728' : '\u{1F44F}'}
            </Animated.Text>
          ))}
          <Animated.View
            style={[
              styles.icon,
              { transform: [{ scale: scaleAnim }, { rotate }] },
            ]}
          >
            <MaterialCommunityIcons
              name="hand-clap"
              size={18}
              color={hasReacted ? colors.primary : colors.textSecondary}
            />
          </Animated.View>
        </View>
        {count > 0 && (
          <Text style={[styles.count, hasReacted && styles.countActive]}>
            {count}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  containerActive: {
    borderColor: colors.primary,
  },
  emojiWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstParticle: {
    position: 'absolute',
    fontSize: 8,
  },
  count: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  countActive: {
    color: colors.primary,
  },
});
