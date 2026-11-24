import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FeedPost } from '../types/database';
import { ParaLogo } from '../components/ParaLogo';
import { PostCard } from '../components/PostCard';
import { PostComposerModal } from '../components/PostComposerModal';

const PAGE_SIZE = 20;

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'for_you' | 'following'>('for_you');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [composerVisible, setComposerVisible] = useState(false);
  const [replyTarget, setReplyTarget] = useState<FeedPost | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<FeedPost | null>(null);

  const loadFeed = useCallback(
    async (offset = 0, replace = false) => {
      if (!profile?.id) return;
      const rpcName = activeTab === 'for_you' ? 'get_for_you_feed' : 'get_following_feed';
      const { data, error } = await supabase.rpc(rpcName, {
        p_user_id: profile.id,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });

      if (!error && data) {
        setPosts((prev) => (replace ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
      }
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    },
    [activeTab, profile?.id]
  );

  useEffect(() => {
    setLoading(true);
    loadFeed(0, true);
  }, [loadFeed]);

  useEffect(() => {
    const channel = supabase
      .channel('home_feed_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        loadFeed(0, true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed(0, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    loadFeed(posts.length, false);
  };

  const navigateMention = async (username: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();
    if (data?.id) navigation.navigate('ProfileDetail', { userId: data.id });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.topAvatar} />
          ) : (
            <View style={[styles.topAvatar, { backgroundColor: colors.surface }]} />
          )}
        </TouchableOpacity>

        <ParaLogo size={24} />

        <TouchableOpacity
          onPress={() =>
            Alert.alert('Timeline Settings', 'Showing weighted engagement + recency on "For You" and live chronological posts + reposts on "Following".')
          }
        >
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(['for_you', 'following'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity key={tab} style={styles.tabBtn} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, { color: isActive ? colors.text : colors.textMuted }]}>
                {tab === 'for_you' ? 'For You' : 'Following'}
              </Text>
              {isActive && <View style={[styles.activePill, { backgroundColor: colors.accent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item, index) => `${item.id}_${item.reposted_by_username ?? 'orig'}_${index}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={colors.accent} /> : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>
                {activeTab === 'following'
                  ? 'Follow people in Explore to see their posts and reposts here.'
                  : 'No posts yet. Tap the + button to publish the first one.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPressPost={(p) => navigation.navigate('PostDetail', { postId: p.id })}
              onPressProfile={(uid) => navigation.navigate('ProfileDetail', { userId: uid })}
              onPressHashtag={(tag) => navigation.navigate('Explore', { initialQuery: tag })}
              onPressMention={navigateMention}
              onReply={(p) => {
                setQuoteTarget(null);
                setReplyTarget(p);
                setComposerVisible(true);
              }}
              onQuote={(p) => {
                setReplyTarget(null);
                setQuoteTarget(p);
                setComposerVisible(true);
              }}
              onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        activeOpacity={0.85}
        onPress={() => {
          setReplyTarget(null);
          setQuoteTarget(null);
          setComposerVisible(true);
        }}
      >
        <MaterialCommunityIcons name="feather" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <PostComposerModal
        visible={composerVisible}
        replyTo={replyTarget}
        quotePost={quoteTarget}
        onClose={() => setComposerVisible(false)}
        onSuccess={() => loadFeed(0, true)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  topAvatar: { width: 32, height: 32, borderRadius: 16 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 15, fontWeight: '700' },
  activePill: {
    position: 'absolute',
    bottom: 0,
    height: 3.5,
    width: 64,
    borderRadius: 2,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { padding: 36, alignItems: 'center' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
});
