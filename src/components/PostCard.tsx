import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Share,
  Alert,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { FeedPost } from '../types/database';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCompactCount, formatRelativeTime } from '../utils/format';
import { RichText } from './RichText';
import { MediaGrid } from './MediaGrid';

interface PostCardProps {
  post: FeedPost;
  onPressPost: (post: FeedPost) => void;
  onPressProfile: (userId: string) => void;
  onPressHashtag: (tag: string) => void;
  onPressMention: (username: string) => void;
  onReply: (post: FeedPost) => void;
  onQuote: (post: FeedPost) => void;
  onDeleted?: (postId: string) => void;
  onPinChanged?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onPressPost,
  onPressProfile,
  onPressHashtag,
  onPressMention,
  onReply,
  onQuote,
  onDeleted,
  onPinChanged,
}) => {
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();

  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [reposted, setReposted] = useState(post.is_reposted);
  const [repostCount, setRepostCount] = useState(post.repost_count);
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked);

  const [repostSheetVisible, setRepostSheetVisible] = useState(false);
  const [menuSheetVisible, setMenuSheetVisible] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  const isOwnPost = profile?.id === post.author_id;
  const isPinned = profile?.pinned_post_id === post.id || post.is_pinned;

  const animateHeart = () => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
  };

  const handleToggleLike = async () => {
    if (!profile) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    if (nextLiked) animateHeart();

    const { error } = nextLiked
      ? await supabase.from('likes').insert({ user_id: profile.id, post_id: post.id })
      : await supabase.from('likes').delete().eq('user_id', profile.id).eq('post_id', post.id);

    if (error) {
      setLiked(!nextLiked);
      setLikeCount((c) => Math.max(0, c + (nextLiked ? -1 : 1)));
    }
  };

  const handleToggleRepost = async () => {
    if (!profile) return;
    setRepostSheetVisible(false);
    const nextReposted = !reposted;
    setReposted(nextReposted);
    setRepostCount((c) => Math.max(0, c + (nextReposted ? 1 : -1)));

    const { error } = nextReposted
      ? await supabase.from('reposts').insert({ user_id: profile.id, post_id: post.id })
      : await supabase.from('reposts').delete().eq('user_id', profile.id).eq('post_id', post.id);

    if (error) {
      setReposted(!nextReposted);
      setRepostCount((c) => Math.max(0, c + (nextReposted ? -1 : 1)));
    }
  };

  const handleToggleBookmark = async () => {
    if (!profile) return;
    const next = !bookmarked;
    setBookmarked(next);

    const { error } = next
      ? await supabase.from('bookmarks').insert({ user_id: profile.id, post_id: post.id })
      : await supabase.from('bookmarks').delete().eq('user_id', profile.id).eq('post_id', post.id);

    if (error) setBookmarked(!next);
  };

  const handleShare = async () => {
    await Share.share({
      message: `${post.author_display_name} (@${post.author_username}) on para:\n\n${post.content}\n\nhttps://para.app/post/${post.id}`,
    });
  };

  const handleDeletePost = () => {
    setMenuSheetVisible(false);
    Alert.alert('Delete post?', 'This can’t be undone and it will be removed from your profile and feeds.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', post.id);
          if (!error) onDeleted?.(post.id);
        },
      },
    ]);
  };

  const handleTogglePin = async () => {
    if (!profile) return;
    setMenuSheetVisible(false);
    const nextPin = isPinned ? null : post.id;
    const { error } = await supabase
      .from('profiles')
      .update({ pinned_post_id: nextPin })
      .eq('id', profile.id);
    if (!error) {
      await refreshProfile();
      onPinChanged?.();
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPressPost(post)}
      style={[styles.card, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
    >
      {post.is_pinned && (
        <View style={styles.contextRow}>
          <MaterialCommunityIcons name="pin" size={14} color={colors.textMuted} />
          <Text style={[styles.contextText, { color: colors.textMuted }]}>Pinned</Text>
        </View>
      )}
      {post.reposted_by_display_name && (
        <View style={styles.contextRow}>
          <Feather name="repeat" size={13} color={colors.textMuted} />
          <Text style={[styles.contextText, { color: colors.textMuted }]}>
            {post.reposted_by_display_name} reposted
          </Text>
        </View>
      )}

      <View style={styles.mainRow}>
        <TouchableOpacity onPress={() => onPressProfile(post.author_id)}>
          {post.author_avatar_url ? (
            <Image source={{ uri: post.author_avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {post.author_display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.body}>
          <View style={styles.headerLine}>
            <TouchableOpacity
              style={styles.headerMeta}
              onPress={() => onPressProfile(post.author_id)}
              activeOpacity={0.7}
            >
              <Text numberOfLines={1} style={[styles.displayName, { color: colors.text }]}>
                {post.author_display_name}
              </Text>
              <Text numberOfLines={1} style={[styles.handle, { color: colors.textMuted }]}>
                @{post.author_username}
              </Text>
              <Text style={[styles.dot, { color: colors.textMuted }]}>·</Text>
              <Text style={[styles.time, { color: colors.textMuted }]}>
                {formatRelativeTime(post.created_at)}
              </Text>
            </TouchableOpacity>

            {isOwnPost && (
              <TouchableOpacity
                onPress={() => setMenuSheetVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {post.content.length > 0 && (
            <RichText
              content={post.content}
              style={{ marginTop: 2 }}
              onPressHashtag={onPressHashtag}
              onPressMention={onPressMention}
            />
          )}

          <MediaGrid urls={post.media_urls} />

          {post.quoted_post && (
            <View style={[styles.quotedCard, { borderColor: colors.border }]}>
              <View style={styles.quotedHeader}>
                {post.quoted_post.author_avatar_url ? (
                  <Image source={{ uri: post.quoted_post.author_avatar_url }} style={styles.quotedAvatar} />
                ) : (
                  <View style={[styles.quotedAvatar, { backgroundColor: colors.surface }]} />
                )}
                <Text numberOfLines={1} style={[styles.quotedName, { color: colors.text }]}>
                  {post.quoted_post.author_display_name}
                </Text>
                <Text numberOfLines={1} style={[styles.quotedHandle, { color: colors.textMuted }]}>
                  @{post.quoted_post.author_username} · {formatRelativeTime(post.quoted_post.created_at)}
                </Text>
              </View>
              {post.quoted_post.content.length > 0 && (
                <Text style={{ color: colors.text, fontSize: 14, marginTop: 4 }} numberOfLines={4}>
                  {post.quoted_post.content}
                </Text>
              )}
              {post.quoted_post.media_urls?.length > 0 && (
                <MediaGrid urls={post.quoted_post.media_urls} />
              )}
            </View>
          )}

          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onReply(post)}>
              <Ionicons name="chatbubble-outline" size={17} color={colors.textMuted} />
              <Text style={[styles.actionCount, { color: colors.textMuted }]}>
                {formatCompactCount(post.reply_count)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => setRepostSheetVisible(true)}>
              <Feather name="repeat" size={17} color={reposted ? colors.repost : colors.textMuted} />
              <Text style={[styles.actionCount, { color: reposted ? colors.repost : colors.textMuted }]}>
                {formatCompactCount(repostCount)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleToggleLike}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={18}
                  color={liked ? colors.like : colors.textMuted}
                />
              </Animated.View>
              <Text style={[styles.actionCount, { color: liked ? colors.like : colors.textMuted }]}>
                {formatCompactCount(likeCount)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleToggleBookmark}>
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={17}
                color={bookmarked ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={repostSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRepostSheetVisible(false)}
      >
        <TouchableOpacity
          style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setRepostSheetVisible(false)}
        >
          <View style={[styles.sheetContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.sheetOption} onPress={handleToggleRepost}>
              <Feather name="repeat" size={20} color={reposted ? colors.repost : colors.text} />
              <Text style={[styles.sheetLabel, { color: colors.text }]}>
                {reposted ? 'Undo Repost' : 'Repost'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setRepostSheetVisible(false);
                onQuote(post);
              }}
            >
              <Feather name="edit-3" size={20} color={colors.text} />
              <Text style={[styles.sheetLabel, { color: colors.text }]}>Quote</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={menuSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuSheetVisible(false)}
      >
        <TouchableOpacity
          style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setMenuSheetVisible(false)}
        >
          <View style={[styles.sheetContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.sheetOption} onPress={handleTogglePin}>
              <MaterialCommunityIcons name="pin-outline" size={21} color={colors.text} />
              <Text style={[styles.sheetLabel, { color: colors.text }]}>
                {isPinned ? 'Unpin from profile' : 'Pin to your profile'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetOption} onPress={handleDeletePost}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.sheetLabel, { color: colors.danger }]}>Delete post</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 36,
    marginBottom: 4,
  },
  contextText: { fontSize: 12, fontWeight: '600' },
  mainRow: { flexDirection: 'row', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1 },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerMeta: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4, marginRight: 8 },
  displayName: { fontWeight: '700', fontSize: 15, flexShrink: 1 },
  handle: { fontSize: 14, flexShrink: 2 },
  dot: { fontSize: 14 },
  time: { fontSize: 14 },
  quotedCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  quotedHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quotedAvatar: { width: 18, height: 18, borderRadius: 9 },
  quotedName: { fontWeight: '700', fontSize: 13 },
  quotedHandle: { fontSize: 13, flex: 1 },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingRight: 8,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  actionCount: { fontSize: 12, minWidth: 14 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  sheetLabel: { fontSize: 16, fontWeight: '500' },
});
