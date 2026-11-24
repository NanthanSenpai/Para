import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { compressAndUploadImage } from '../utils/media';

export const OnboardingScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const { session, profile, refreshProfile } = useAuth();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [bannerUri, setBannerUri] = useState<string | null>(profile?.banner_url ?? null);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    if (profile && clean === profile.username.toLowerCase()) {
      setUsernameStatus('available');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', clean)
        .maybeSingle();

      setUsernameStatus(data ? 'taken' : 'available');
    }, 350);

    return () => clearTimeout(timer);
  }, [username, profile]);

  const pickImage = async (target: 'avatar' | 'banner') => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: target === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      if (target === 'avatar') setAvatarUri(res.assets[0].uri);
      else setBannerUri(res.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;
    if (usernameStatus !== 'available') {
      Alert.alert('Choose a unique @username', 'Your handle must be 3-20 letters, numbers, or underscores and not taken.');
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Display name required', 'Please enter your display name.');
      return;
    }

    setSaving(true);
    try {
      let finalAvatar = avatarUri;
      let finalBanner = bannerUri;

      if (avatarUri && !avatarUri.startsWith('http')) {
        finalAvatar = await compressAndUploadImage(avatarUri, session.user.id, 'avatars', 512);
      }
      if (bannerUri && !bannerUri.startsWith('http')) {
        finalBanner = await compressAndUploadImage(bannerUri, session.user.id, 'banners', 1200);
      }

      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: finalAvatar,
        banner_url: finalBanner,
      });

      if (error) throw error;
      await refreshProfile();
      if (navigation?.canGoBack()) navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not save profile', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: colors.surface }]}
        onPress={() => pickImage('banner')}
      >
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} />
        ) : (
          <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
        )}
      </TouchableOpacity>

      <View style={styles.avatarRow}>
        <TouchableOpacity
          style={[styles.avatarWrap, { borderColor: colors.background, backgroundColor: colors.surface }]}
          onPress={() => pickImage('avatar')}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={[styles.title, { color: colors.text }]}>
          {profile ? 'Edit profile' : 'Set up your profile'}
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>Username</Text>
        <View style={[styles.usernameBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>@</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="username"
            placeholderTextColor={colors.textMuted}
            style={[styles.usernameInput, { color: colors.text }]}
          />
          {usernameStatus === 'checking' && <ActivityIndicator size="small" color={colors.accent} />}
          {usernameStatus === 'available' && <Ionicons name="checkmark-circle" size={20} color={colors.repost} />}
          {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          )}
        </View>
        {usernameStatus === 'taken' && (
          <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>That @username is already taken.</Text>
        )}
        {usernameStatus === 'invalid' && (
          <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>
            Use 3–20 characters (letters, numbers, underscore).
          </Text>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>Display Name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={50}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          maxLength={160}
          multiline
          placeholder="Tell people about yourself"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: 90, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: colors.accent, opacity: saving || usernameStatus !== 'available' ? 0.5 : 1 },
          ]}
          disabled={saving || usernameStatus !== 'available'}
          onPress={handleSave}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save & Continue</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { height: 135, justifyContent: 'center', alignItems: 'center' },
  avatarRow: { paddingHorizontal: 18, marginTop: -38 },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  form: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  usernameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  usernameInput: { flex: 1, fontSize: 16, marginLeft: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  saveBtn: {
    marginTop: 26,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
