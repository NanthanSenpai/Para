import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { compressAndUploadImage } from '../utils/media';
import { FeedPost } from '../types/database';

interface PostComposerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  replyTo?: FeedPost | null;
  quotePost?: FeedPost | null;
}

const MAX_CHARS = 280;
const RING_RADIUS = 11;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const PostComposerModal: React.FC<PostComposerModalProps> = ({
  visible,
  onClose,
  onSuccess,
  replyTo,
  quotePost,
}) => {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const remaining = MAX_CHARS - content.length;
  const progress = Math.min(content.length / MAX_CHARS, 1);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  const ringColor =
    content.length > MAX_CHARS
      ? colors.danger
      : content.length >= 260
      ? colors.warning
      : colors.accent;

  const canPost =
    !submitting &&
    content.length <= MAX_CHARS &&
    (content.trim().length > 0 || localImages.length > 0 || Boolean(quotePost));

  const pickImages = async () => {
    const remainingSlots = 4 - localImages.length;
    if (remainingSlots <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.9,
    });

    if (!result.canceled) {
      const picked = result.assets.map((a) => a.uri).slice(0, remainingSlots);
      setLocalImages((prev) => [...prev, ...picked]);
    }
  };

  const handlePublish = async () => {
    if (!canPost || !profile) return;
    setSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const uri of localImages) {
        const url = await compressAndUploadImage(uri, profile.id, 'posts');
        uploadedUrls.push(url);
      }

      const { error } = await supabase.from('posts').insert({
        author_id: profile.id,
        content: content.trim(),
        media_urls: uploadedUrls,
        parent_id: replyTo?.id ?? null,
        quoted_post_id: quotePost?.id ?? null,
      });

      if (error) throw error;

      setContent('');
      setLocalImages([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Post failed', err.message || 'Could not publish post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={submitting}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePublish}
            disabled={!canPost}
            style={[
              styles.postBtn,
              { backgroundColor: colors.accent, opacity: canPost ? 1 : 0.45 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.postBtnText}>{replyTo ? 'Reply' : 'Post'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {replyTo && (
            <Text style={[styles.replyHint, { color: colors.textMuted }]}>
              Replying to <Text style={{ color: colors.accent }}>@{replyTo.author_username}</Text>
            </Text>
          )}

          <View style={styles.composerRow}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.surface }]} />
            )}

            <View style={{ flex: 1 }}>
              <TextInput
                multiline
                autoFocus
                placeholder={replyTo ? 'Post your reply' : "What's happening?"}
                placeholderTextColor={colors.textMuted}
                value={content}
                onChangeText={setContent}
                style={[styles.input, { color: colors.text }]}
              />

              {localImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  {localImages.map((uri, i) => (
                    <View key={i} style={styles.previewWrap}>
                      <Image source={{ uri }} style={styles.previewImg} />
                      <TouchableOpacity
                        style={styles.removeImgBtn}
                        onPress={() => setLocalImages((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Ionicons name="close" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {quotePost && (
                <View style={[styles.quoteBox, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                    {quotePost.author_display_name}{' '}
                    <Text style={{ color: colors.textMuted, fontWeight: '400' }}>
                      @{quotePost.author_username}
                    </Text>
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14, marginTop: 3 }} numberOfLines={3}>
                    {quotePost.content}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={pickImages}
            disabled={localImages.length >= 4}
            style={{ opacity: localImages.length >= 4 ? 0.4 : 1 }}
          >
            <Ionicons name="image-outline" size={24} color={colors.accent} />
          </TouchableOpacity>

          <View style={styles.ringWrap}>
            {content.length >= 260 && (
              <Text
                style={{
                  color: content.length > MAX_CHARS ? colors.danger : colors.textMuted,
                  fontSize: 13,
                  fontWeight: '600',
                  marginRight: 8,
                }}
              >
                {remaining}
              </Text>
            )}
            <Svg width={28} height={28}>
              <Circle
                cx={14}
                cy={14}
                r={RING_RADIUS}
                stroke={colors.border}
                strokeWidth={2.5}
                fill="none"
              />
              <Circle
                cx={14}
                cy={14}
                r={RING_RADIUS}
                stroke={ringColor}
                strokeWidth={2.5}
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin="14, 14"
              />
            </Svg>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  postBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 74,
    alignItems: 'center',
  },
  postBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  scroll: { flex: 1, padding: 16 },
  replyHint: { marginLeft: 50, marginBottom: 8, fontSize: 14 },
  composerRow: { flexDirection: 'row', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  input: { fontSize: 18, lineHeight: 24, minHeight: 110, textAlignVertical: 'top' },
  previewWrap: { marginRight: 8, position: 'relative' },
  previewImg: { width: 140, height: 140, borderRadius: 12 },
  removeImgBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: 4,
  },
  quoteBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  ringWrap: { flexDirection: 'row', alignItems: 'center' },
});
