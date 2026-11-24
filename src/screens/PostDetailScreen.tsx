import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FeedPost } from '../types/database';
import { PostCard } from '../components/PostCard';
import { PostComposerModal } from '../components/PostComposerModal';

export const PostDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { postId } = route.params;
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [parentPost, setParentPost] = useState<FeedPost | null>(null);
  const [replies, setReplies] = useState<FeedPost[]>([]);
  const [replyOpen, setReplyOpen] = useState(false);

  const loadThread = useCallback(async () => {
    if (!profile?.id) return;
    const [{ data: main }, { data: childRows }] = await Promise.all([
      supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*)').eq('id', postId).single(),
      supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(*)')
        .eq('parent_id', postId)
        .order('created_at', { ascending: true }),
    ]);

    const all = [main, ...(childRows ?? [])].filter(Boolean);
    const ids = all.map((p: any) => p.id);

    const [{ data: liked }, { data: reposted }, { data: bookmarked }] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', profile.id).in('post_id', ids),
      supabase.from('reposts').select('post_id').eq('user_id', profile.id).in('post_id', ids),
      supabase.from('bookmarks').select('post_id').eq('user_id', profile.id).in('post_id', ids),
    ]);

    const likeSet = new Set((liked ?? []).map((x: any) => x.post_id));
    const rpSet = new Set((reposted ?? []).map((x: any) => x.post_id));
    const bmSet = new Set((bookmarked ?? []).map((x: any) => x.post_id));

    const mapPost = (p: any): FeedPost => ({
      id: p.id,
      author_id: p.author_id,
      author_username: p.author.username,
      author_display_name: p.author.display_name,
      author_avatar_url: p.author.avatar_url,
      content: p.content,
      media_urls: p.media_urls,
      parent_id: p.parent_id,
      quoted_post: null,
      like_count: p.like_count,
      repost_count: p.repost_count,
      reply_count: p.reply_count,
      created_at: p.created_at,
      feed_time: p.created_at,
      reposted_by_username: null,
      reposted_by_display_name: null,
      is_liked: likeSet.has(p.id),
      is_reposted: rpSet.has(p.id),
      is_bookmarked: bmSet.has(p.id),
    });

    if (main) setParentPost(mapPost(main));
    setReplies((childRows ?? []).map(mapPost));
  }, [postId, profile?.id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          parentPost ? (
            <PostCard
              post={parentPost}
              onPressPost={() => {}}
              onPressProfile={(uid) => navigation.navigate('ProfileDetail', { userId: uid })}
              onPressHashtag={(tag) => navigation.navigate('Explore', { initialQuery: tag })}
              onPressMention={() => {}}
              onReply={() => setReplyOpen(true)}
              onQuote={() => {}}
              onDeleted={() => navigation.goBack()}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPressPost={(p) => navigation.push('PostDetail', { postId: p.id })}
            onPressProfile={(uid) => navigation.navigate('ProfileDetail', { userId: uid })}
            onPressHashtag={(tag) => navigation.navigate('Explore', { initialQuery: tag })}
            onPressMention={() => {}}
            onReply={() => setReplyOpen(true)}
            onQuote={() => {}}
            onDeleted={(id) => setReplies((prev) => prev.filter((r) => r.id !== id))}
          />
        )}
      />

      {parentPost && (
        <TouchableOpacity
          style={[styles.replyBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}
          onPress={() => setReplyOpen(true)}
        >
          <View style={[styles.replyPill, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.textMuted }}>Post your reply</Text>
          </View>
        </TouchableOpacity>
      )}

      <PostComposerModal
        visible={replyOpen}
        replyTo={parentPost}
        onClose={() => setReplyOpen(false)}
        onSuccess={loadThread}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  replyBar: { padding: 12, borderTopWidth: 1 },
  replyPill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 },
});
