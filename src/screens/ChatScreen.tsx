import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRealtimeBadges } from '../context/RealtimeBadgesContext';
import { supabase } from '../lib/supabase';
import { MessageItem } from '../types/database';

export const ChatScreen: React.FC<{ route: any }> = ({ route }) => {
  const { conversationId, otherUser } = route.params;
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { refreshBadges } = useRealtimeBadges();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('recipient_id', profile.id)
        .eq('is_read', false);
      refreshBadges();
    };

    load();

    const sub = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const msg = payload.new as MessageItem;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.recipient_id === profile.id) {
            await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
            refreshBadges();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [conversationId, profile?.id, refreshBadges]);

  const sendMessage = async () => {
    if (!draft.trim() || !profile?.id) return;
    const text = draft.trim();
    setDraft('');
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      recipient_id: otherUser.id,
      content: text,
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === profile?.id;
          return (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  backgroundColor: isMe ? colors.accent : colors.surface,
                },
              ]}
            >
              <Text style={{ color: isMe ? '#FFFFFF' : colors.text, fontSize: 15 }}>
                {item.content}
              </Text>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Start a message"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
        />
        <TouchableOpacity onPress={sendMessage} style={{ padding: 8 }}>
          <Ionicons name="send" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
});
