import React, { useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Typography, Spacing, Layout, Shadows } from '@/constants/theme';
import { api } from '@/lib/api';
import LogSheet from '@/components/log/LogSheet';

/**
 * Tab bar layout — Home, Explore, Notifications, Profile.
 * Shows unread badge on the Notifications tab.
 */
export default function TabLayout() {
  const [logSheetVisible, setLogSheetVisible] = useState(false);
  const bottomSheetRef = useRef<any>(null);

  // Fetch unread notification count for badge
  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const response = await api.get('/notifications/unread-count');
      return (response.data as { unread_count: number }).unread_count;
    },
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 0, // Always refetch
  });

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background,
            shadowOpacity: 0,
            elevation: 0,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: Colors.borderLight,
          },
          headerTitleStyle: {
            ...Typography.h4,
            color: Colors.text,
          },
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: Colors.borderLight,
            height: Layout.tabBarHeight,
            paddingBottom: 28,
            paddingTop: Spacing.sm,
            overflow: 'visible',
          },
          tabBarActiveTintColor: Colors.tabActive,
          tabBarInactiveTintColor: Colors.tabInactive,
          tabBarLabelStyle: {
            ...Typography.tab,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerTitle: 'Momentum',
            headerTitleStyle: {
              ...Typography.h3,
              color: Colors.text,
            },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'compass' : 'compass-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="create"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setLogSheetVisible(true);
            },
          }}
          options={{
            title: '',
            headerShown: false,
            tabBarLabel: '',
            tabBarItemStyle: {
              overflow: 'visible',
            },
            tabBarButton: ({ accessibilityLabel, accessibilityState, testID, style }) => (
              <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityState={accessibilityState}
                testID={testID}
                style={[style, styles.createButton]}
                onPress={() => setLogSheetVisible(true)}
                hitSlop={12}
              >
                <View pointerEvents="none" style={styles.createButtonInner}>
                  <Ionicons name="add" size={28} color={Colors.textInverse} />
                </View>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color, focused }) => (
              <View>
                <Ionicons
                  name={focused ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color={color}
                />
                {unreadCount != null && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
      </Tabs>

      {logSheetVisible && (
        <LogSheet
          bottomSheetRef={bottomSheetRef}
          onClose={() => setLogSheetVisible(false)}
          onSuccess={() => setLogSheetVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  createButton: {
    top: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonInner: {
    width: Layout.fabSize,
    height: Layout.fabSize,
    borderRadius: Layout.fabSize / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.large,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...Typography.captionMedium,
    color: Colors.textInverse,
    fontSize: 10,
    lineHeight: 14,
  },
});
