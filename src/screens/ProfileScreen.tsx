import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FeedPost, Profile } from '../types/database';
import { PostCard } from '../components/PostCard';

export const ProfileScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { profile: myProfile } = useAuth();
  const targetUserId: string = route?.params?.userId ?? myProfile?.id;

  const [user, setUser] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tab, setTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');
  const [posts, setPosts] = useState<FeedPost[]>([]);

  const isMe = targetUserId === myProfile?.id;

  const loadProfileData = useCallback(async () => {
    if (!targetUserId || !myProfile?.id) return;

    const [{ data: profileData }, { data: followRow }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetUserId).single(),
      isMe
        ? Promise.resolve({ data: null })
        : supabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', myProfile.id)
            .eq('following_id', targetUserId)
            .maybeSingle(),
    ]);

    if (profileData) setUser(profileData);
    setIsFollowing(Boolean(followRow));

    let rawPosts: any[] = [];
    if (tab === 'likes') {
      const { data } = await supabase
        .from('likes')
        .select('post:posts(*, author:profiles!posts_author_id_fkey(*))')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(40);
      rawPosts = (data ?? []).map((r: any) => r.post).filter(Boolean);
    } else {
      let query = supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(*)')
        .eq('author_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(40);

      if (tab === 'posts') query = query.is('parent_id', null);
      if (tab === 'replies') query = query.not('parent_id', 'is', null);
      if (tab === 'media') query = query.neq('media_urls', '{}');

      const { data } = await query;
      rawPosts = data ?? [];
    }

    const ids = rawPosts.map((p) => p.id);
    const [{ data: liked }, { data: reposted }, { data: bookmarked }] =
      ids.length > 0
        ? await Promise.all([
            supabase.from('likes').select('post_id').eq('user_id', myProfile.id).in('post_id', ids),
            supabase.from('reposts').select('post_id').eq('user_id', myProfile.id).in('post_id', ids),
            supabase.from('bookmarks').select('post_id').eq('user_id', myProfile.id).in('post_id', ids),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];

    const likeSet = new Set((liked ?? []).map((x: any) => x.post_id));
    const rpSet = new Set((reposted ?? []).map((x: any) => x.post_id));
    const bmSet = new Set((bookmarked ?? []).map((x: any) => x.post_id));

    const mapped: FeedPost[] = rawPosts.map((p: any) => ({
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
      is_pinned: tab === 'posts' && profileData?.pinned_post_id === p.id,
    }));

    if (tab === 'posts' && profileData?.pinned_post_id) {
      mapped.sort((a, b) => (a.is_pinned ? -1 : b.is_pinned ? 1 : 0));
    }

    setPosts(mapped);
  }, [targetUserId, myProfile?.id, isMe, tab]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const toggleFollow = async () => {
    if (!myProfile || !user) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setUser((u) => (u ? { ...u, followers_count: Math.max(0, u.followers_count + (next ? 1 : -1)) } : u));

    if (next) {
      await supabase.from('follows').insert({ follower_id: myProfile.id, following_id: user.id });
    } else {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', myProfile.id)
        .eq('following_id', user.id);
    }
  };

  const startDM = async () => {
    if (!user) return;
    const { data: convId } = await supabase.rpc('get_or_create_conversation', {
      p_other_user_id: user.id,
    });
    if (convId) {
      navigation.navigate('Chat', { conversationId: convId, otherUser: user });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          user ? (
            <View>
              <View style={[styles.banner, { backgroundColor: colors.surface }]}>
                {user.banner_url && <Image source={{ uri: user.banner_url }} style={StyleSheet.absoluteFill} />}
              </View>

              <View style={styles.headerBody}>
                <View style={styles.avatarActionRow}>
                  <View style={[styles.avatarWrap, { borderColor: colors.background, backgroundColor: colors.surface }]}>
                    {user.avatar_url && <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />}
                  </View>

                  <View style={styles.actions}>
                    {isMe ? (
                      <TouchableOpacity
                        style={[styles.outlineBtn, { borderColor: colors.border }]}
                        onPress={() => navigation.navigate('OnboardingEdit')}
                      >
                        <Text style={{ color: colors.text, fontWeight: '700' }}>Edit profile</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.iconBtn, { borderColor: colors.border }]}
                          onPress={startDM}
                        >
                          <Ionicons name="mail-outline" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.followBtn,
                            {
                              backgroundColor: isFollowing ? 'transparent' : colors.text,
                              borderColor: colors.border,
                              borderWidth: isFollowing ? 1 : 0,
                            },
                          ]}
                          onPress={toggleFollow}
                        >
                          <Text
                            style={{
                              color: isFollowing ? colors.text : colors.background,
                              fontWeight: '700',
                            }}
                          >
                            {isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>

                <Text style={[styles.name, { color: colors.text }]}>{user.display_name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>@{user.username}</Text>
                {user.bio ? <Text style={[styles.bio, { color: colors.text }]}>{user.bio}</Text> : null}

                <View style={styles.statsRow}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {user.following_count}{' '}
                    <Text style={{ color: colors.textMuted, fontWeight: '400' }}>Following</Text>
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {user.followers_count}{' '}
                    <Text style={{ color: colors.textMuted, fontWeight: '400' }}>Followers</Text>
                  </Text>
                </View>
              </View>

              <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
                {(['posts', 'replies', 'media', 'likes'] as const).map((t) => (
                  <TouchableOpacity key={t} style={styles.tabBtn} onPress={() => setTab(t)}>
                    <Text
                      style={{
                        color: tab === t ? colors.text : colors.textMuted,
                        fontWeight: '700',
                        textTransform: 'capitalize',
                      }}
                    >
                      {t}
                    </Text>
                    {tab === t && <View style={[styles.pill, { backgroundColor: colors.accent }]} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPressPost={(p) => navigation.navigate('PostDetail', { postId: p.id })}
            onPressProfile={(uid) => navigation.navigate('ProfileDetail', { userId: uid })}
            onPressHashtag={(tag) => navigation.navigate('Explore', { initialQuery: tag })}
            onPressMention={() => {}}
            onReply={(p) => navigation.navigate('PostDetail', { postId: p.id })}
            onQuote={(p) => navigation.navigate('PostDetail', { postId: p.id })}
            onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            onPinChanged={loadProfileData}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { height: 130 },
  headerBody: { paddingHorizontal: 16, paddingBottom: 12 },
  avatarActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -36 },
  avatarWrap: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  outlineBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  iconBtn: { borderWidth: 1, borderRadius: 20, padding: 7 },
  followBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  name: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  bio: { fontSize: 15, marginTop: 8, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  pill: { position: 'absolute', bottom: 0, height: 3, width: 48, borderRadius: 2 },
});
