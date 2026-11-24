import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ConversationItem } from '../types/database';
import { formatRelativeTime } from '../utils/format';

export const MessagesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const loadConversations = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('conversations')
      .select(`
        *,
        p1:profiles!conversations_participant_1_fkey(id, username, display_name, avatar_url),
        p2:profiles!conversations_participant_2_fkey(id, username, display_name, avatar_url)
      `)
      .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
      .order('last_message_at', { ascending: false });

    if (!data) return;

    const { data: unreadRows } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('recipient_id', profile.id)
      .eq('is_read', false);

    const unreadMap = new Map<string, number>();
    (unreadRows ?? []).forEach((r: any) => {
      unreadMap.set(r.conversation_id, (unreadMap.get(r.conversation_id) || 0) + 1);
    });

    setConversations(
      data.map((c: any) => ({
        id: c.id,
        other_user: c.participant_1 === profile.id ? c.p2 : c.p1,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        unread_count: unreadMap.get(c.id) || 0,
      }))
    );
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
            No messages yet. Open any user profile to start a conversation.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() =>
              navigation.navigate('Chat', {
                conversationId: item.id,
                otherUser: item.other_user,
              })
            }
          >
            {item.other_user.avatar_url ? (
              <Image source={{ uri: item.other_user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.surface }]} />
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.metaRow}>
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                  {item.other_user.display_name}{' '}
                  <Text style={{ color: colors.textMuted, fontWeight: '400' }}>
                    @{item.other_user.username}
                  </Text>
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {formatRelativeTime(item.last_message_at)}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{
                  color: item.unread_count > 0 ? colors.text : colors.textMuted,
                  fontWeight: item.unread_count > 0 ? '700' : '400',
                  marginTop: 2,
                }}
              >
                {item.last_message ?? 'Say hello'}
              </Text>
            </View>
            {item.unread_count > 0 && (
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
