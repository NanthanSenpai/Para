import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FeedPost, Profile } from '../types/database';
import { PostCard } from '../components/PostCard';

export const ExploreScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [trends, setTrends] = useState<{ hashtag: string; post_count: number }[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    if (route.params?.initialQuery) setQuery(route.params.initialQuery);
  }, [route.params?.initialQuery]);

  useEffect(() => {
    supabase.rpc('get_trending_hashtags', { p_limit: 10 }).then(({ data }) => {
      if (data) setTrends(data);
    });
  }, []);

  useEffect(() => {
    const clean = query.trim();
    if (!clean) {
      setUsers([]);
      setPosts([]);
      return;
    }

    const timer = setTimeout(async () => {
      const [{ data: userRows }, { data: postRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${clean.replace(/^@/, '')}%,display_name.ilike.%${clean}%`)
          .limit(6),
        supabase
          .from('posts')
          .select('*, author:profiles!posts_author_id_fkey(*)')
          .ilike('content', `%${clean}%`)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setUsers(userRows ?? []);

      if (postRows && profile) {
        const ids = postRows.map((p: any) => p.id);
        const [{ data: liked }, { data: reposted }, { data: bookmarked }] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', profile.id).in('post_id', ids),
          supabase.from('reposts').select('post_id').eq('user_id', profile.id).in('post_id', ids),
          supabase.from('bookmarks').select('post_id').eq('user_id', profile.id).in('post_id', ids),
        ]);
        const likeSet = new Set((liked ?? []).map((x: any) => x.post_id));
        const rpSet = new Set((reposted ?? []).map((x: any) => x.post_id));
        const bmSet = new Set((bookmarked ?? []).map((x: any) => x.post_id));

        setPosts(
          postRows.map((p: any) => ({
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
          }))
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, profile]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.searchHeader, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search para"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!query.trim() ? (
        <FlatList
          data={trends}
          keyExtractor={(item) => item.hashtag}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending on para</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.trendRow, { borderBottomColor: colors.border }]}
              onPress={() => setQuery(`#${item.hashtag}`)}
            >
              <Text style={[styles.trendTag, { color: colors.text }]}>#{item.hashtag}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {item.post_count} {item.post_count === 1 ? 'post' : 'posts'}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            users.length > 0 ? (
              <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.userRow}
                    onPress={() => navigation.navigate('ProfileDetail', { userId: u.id })}
                  >
                    {u.avatar_url ? (
                      <Image source={{ uri: u.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: colors.surface }]} />
                    )}
                    <View>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{u.display_name}</Text>
                      <Text style={{ color: colors.textMuted }}>@{u.username}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPressPost={(p) => navigation.navigate('PostDetail', { postId: p.id })}
              onPressProfile={(uid) => navigation.navigate('ProfileDetail', { userId: uid })}
              onPressHashtag={(tag) => setQuery(tag)}
              onPressMention={(handle) => setQuery(`@${handle}`)}
              onReply={(p) => navigation.navigate('PostDetail', { postId: p.id })}
              onQuote={(p) => navigation.navigate('PostDetail', { postId: p.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  sectionTitle: { fontSize: 19, fontWeight: '800', padding: 16 },
  trendRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  trendTag: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
});
