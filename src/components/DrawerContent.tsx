import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';

export const DrawerContent: React.FC<DrawerContentComponentProps> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <DrawerContentScrollView contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity
          onPress={() => {
            navigation.closeDrawer();
            if (profile) navigation.navigate('ProfileDetail', { userId: profile.id });
          }}
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.surface }]} />
          )}
          <Text style={[styles.name, { color: colors.text }]}>{profile?.display_name}</Text>
          <Text style={[styles.handle, { color: colors.textMuted }]}>@{profile?.username}</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {profile?.following_count ?? 0}{' '}
            <Text style={{ color: colors.textMuted, fontWeight: '400' }}>Following</Text>
          </Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {profile?.followers_count ?? 0}{' '}
            <Text style={{ color: colors.textMuted, fontWeight: '400' }}>Followers</Text>
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.closeDrawer();
            if (profile) navigation.navigate('ProfileDetail', { userId: profile.id });
          }}
        >
          <Ionicons name="person-outline" size={23} color={colors.text} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate('Bookmarks');
          }}
        >
          <Ionicons name="bookmark-outline" size={23} color={colors.text} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>Bookmarks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate('OnboardingEdit');
          }}
        >
          <Ionicons name="settings-outline" size={23} color={colors.text} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>Settings & Profile</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.themeRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={22} color={colors.text} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Lights Out (Pure Black)</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </DrawerContentScrollView>

      <TouchableOpacity
        style={[styles.signOutBtn, { borderTopColor: colors.border }]}
        onPress={signOut}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '600' }}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 10 },
  name: { fontSize: 18, fontWeight: '800' },
  handle: { fontSize: 14, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
  divider: { height: 1, marginVertical: 18 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 13 },
  menuLabel: { fontSize: 18, fontWeight: '700' },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
  },
});
