import React, { useCallback, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FeedPost } from '../types/database';
import { PostCard } from '../components/PostCard';

export const BookmarksScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      supabase
        .from('bookmarks')
        .select('post:posts(*, author:profiles!posts_author_id_fkey(*))')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (!data) return;
          setPosts(
            data
              .map((r: any) => r.post)
              .filter(Boolean)
              .map((p: any) => ({
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
                is_liked: false,
                is_reposted: false,
                is_bookmarked: true,
              }))
          );
        });
    }, [profile?.id])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
            Save posts for later by tapping the bookmark icon.
          </Text>
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
          />
        )}
      />
    </View>
  );
};
