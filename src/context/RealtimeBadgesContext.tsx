import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface BadgesContextValue {
  unreadNotifications: number;
  unreadMessages: number;
  refreshBadges: () => Promise<void>;
}

const RealtimeBadgesContext = createContext<BadgesContextValue>({
  unreadNotifications: 0,
  unreadMessages: 0,
  refreshBadges: async () => {},
});

export const RealtimeBadgesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshBadges = useCallback(async () => {
    if (!profile?.id) {
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }

    const [{ count: notifCount }, { count: msgCount }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', profile.id)
        .eq('is_read', false),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', profile.id)
        .eq('is_read', false),
    ]);

    setUnreadNotifications(notifCount || 0);
    setUnreadMessages(msgCount || 0);
  }, [profile?.id]);

  useEffect(() => {
    refreshBadges();
    if (!profile?.id) return;

    const channel = supabase
      .channel(`badges_${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` },
        () => refreshBadges()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${profile.id}` },
        () => refreshBadges()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, refreshBadges]);

  return (
    <RealtimeBadgesContext.Provider value={{ unreadNotifications, unreadMessages, refreshBadges }}>
      {children}
    </RealtimeBadgesContext.Provider>
  );
};

export const useRealtimeBadges = () => useContext(RealtimeBadgesContext);