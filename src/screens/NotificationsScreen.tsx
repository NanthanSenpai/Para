import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRealtimeBadges } from '../context/RealtimeBadgesContext';
import { supabase } from '../lib/supabase';
import { NotificationItem } from '../types/database';
import { formatRelativeTime } from '../utils/format';

export const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { refreshBadges } = useRealtimeBadges();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url),
        post:posts(id, content)
      `)
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setItems(data as any);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', profile.id)
      .eq('is_read', false);

    refreshBadges();
  }, [profile?.id, refreshBadges]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  useEffect(() => {
    if (!profile?.id) return;
    const sub = supabase
      .channel(`notif_screen_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` },
        fetchNotifications
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [profile?.id, fetchNotifications]);

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Ionicons name="heart" size={22} color={colors.like} />;
      case 'repost':
        return <Feather name="repeat" size={20} color={colors.repost} />;
      case 'follow':
        return <Ionicons name="person" size={22} color={colors.accent} />;
      default:
        return <Ionicons name="chatbubble" size={20} color={colors.accent} />;
    }
  };

  const labelFor = (n: NotificationItem) => {
    switch (n.type) {
      case 'like': return 'liked your post';
      case 'repost': return 'reposted your post';
      case 'reply': return 'replied to your post';
      case 'quote': return 'quoted your post';
      case 'mention': return 'mentioned you';
      case 'follow': return 'followed you';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => {
              if (item.post_id) navigation.navigate('PostDetail', { postId: item.post_id });
              else navigation.navigate('ProfileDetail', { userId: item.actor.id });
            }}
          >
            <View style={styles.iconCol}>{renderIcon(item.type)}</View>
            <View style={{ flex: 1 }}>
              {item.actor.avatar_url ? (
                <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.surface }]} />
              )}
              <Text style={{ color: colors.text, marginTop: 6, fontSize: 15 }}>
                <Text style={{ fontWeight: '700' }}>{item.actor.display_name}</Text>{' '}
                {labelFor(item)}{' '}
                <Text style={{ color: colors.textMuted }}>· {formatRelativeTime(item.created_at)}</Text>
              </Text>
              {item.post?.content ? (
                <Text style={{ color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>
                  {item.post.content}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  row: { flexDirection: 'row', padding: 14, borderBottomWidth: 1, gap: 12 },
  iconCol: { width: 28, alignItems: 'flex-end', paddingTop: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
});
