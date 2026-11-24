import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ParaLogo } from '../components/ParaLogo';

export const AuthScreen: React.FC = () => {
  const { colors } = useTheme();
  const { signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Invalid credentials', 'Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err: any) {
      Alert.alert('Authentication failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logoWrap}>
        <ParaLogo size={42} />
      </View>

      <Text style={[styles.heading, { color: colors.text }]}>
        {isSignUp ? 'Create your para account' : 'Sign in to para'}
      </Text>

      <TouchableOpacity
        style={[styles.googleBtn, { backgroundColor: colors.text }]}
        onPress={() => signInWithGoogle().catch((e) => Alert.alert('Google Sign-In Error', e.message))}
      >
        <Ionicons name="logo-google" size={18} color={colors.background} />
        <Text style={[styles.googleBtnText, { color: colors.background }]}>Continue with Google</Text>
      </TouchableOpacity>

      <View style={styles.orRow}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.textMuted, marginHorizontal: 12 }}>or</Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      <TextInput
        placeholder="Email address"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        onPress={handleEmailAuth}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>{isSignUp ? 'Sign up' : 'Log in'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchBtn} onPress={() => setIsSignUp((v) => !v)}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>
            {isSignUp ? 'Log in' : 'Sign up'}
          </Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  heading: { fontSize: 26, fontWeight: '800', marginBottom: 24 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    borderRadius: 24,
  },
  googleBtnText: { fontWeight: '700', fontSize: 15 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 14,
  },
  primaryBtn: {
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  switchBtn: { marginTop: 22, alignItems: 'center' },
});
