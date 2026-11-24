
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABLES
-- ==========================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 160),
  avatar_url TEXT,
  banner_url TEXT,
  pinned_post_id UUID,
  followers_count INT NOT NULL DEFAULT 0,
  following_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX profiles_username_lower_uidx ON public.profiles (LOWER(username));

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 280),
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  parent_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  quoted_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  like_count INT NOT NULL DEFAULT 0,
  repost_count INT NOT NULL DEFAULT 0,
  reply_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT post_must_have_body CHECK (
    char_length(TRIM(content)) > 0 OR array_length(media_urls, 1) > 0 OR quoted_post_id IS NOT NULL
  ),
  CONSTRAINT max_four_images CHECK (COALESCE(array_length(media_urls, 1), 0) <= 4)
);

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_pinned_post
  FOREIGN KEY (pinned_post_id) REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX posts_author_created_idx ON public.posts (author_id, created_at DESC);
CREATE INDEX posts_parent_idx ON public.posts (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX posts_created_idx ON public.posts (created_at DESC);

CREATE TABLE public.likes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE public.reposts (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX reposts_user_created_idx ON public.reposts (user_id, created_at DESC);

CREATE TABLE public.bookmarks (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'repost', 'reply', 'quote', 'follow', 'mention')),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_recipient_idx ON public.notifications (recipient_id, is_read, created_at DESC);

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (participant_1 < participant_2),
  UNIQUE (participant_1, participant_2)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(TRIM(content)) > 0),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX messages_conv_created_idx ON public.messages (conversation_id, created_at ASC);
CREATE INDEX messages_unread_idx ON public.messages (recipient_id, is_read) WHERE is_read = FALSE;

-- ==========================================
-- 2. ATOMIC COUNTER & NOTIFICATION TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION public.trg_likes_sync() RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id RETURNING author_id INTO v_author;
    IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
      VALUES (v_author, NEW.user_id, 'like', NEW.post_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_likes_change
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.trg_likes_sync();

CREATE OR REPLACE FUNCTION public.trg_reposts_sync() RETURNS TRIGGER AS $$
DECLARE v_author UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id RETURNING author_id INTO v_author;
    IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
      VALUES (v_author, NEW.user_id, 'repost', NEW.post_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET repost_count = GREATEST(0, repost_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_reposts_change
AFTER INSERT OR DELETE ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.trg_reposts_sync();

CREATE OR REPLACE FUNCTION public.trg_posts_sync() RETURNS TRIGGER AS $$
DECLARE
  v_parent_author UUID;
  v_quote_author UUID;
  v_mention TEXT;
  v_mentioned_user UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE public.posts SET reply_count = reply_count + 1 WHERE id = NEW.parent_id RETURNING author_id INTO v_parent_author;
      IF v_parent_author IS NOT NULL AND v_parent_author <> NEW.author_id THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
        VALUES (v_parent_author, NEW.author_id, 'reply', NEW.id);
      END IF;
    END IF;

    IF NEW.quoted_post_id IS NOT NULL THEN
      SELECT author_id INTO v_quote_author FROM public.posts WHERE id = NEW.quoted_post_id;
      IF v_quote_author IS NOT NULL AND v_quote_author <> NEW.author_id THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
        VALUES (v_quote_author, NEW.author_id, 'quote', NEW.id);
      END IF;
    END IF;

    FOR v_mention IN
      SELECT DISTINCT (regexp_matches(NEW.content, '@([a-zA-Z0-9_]{3,20})', 'g'))[1]
    LOOP
      SELECT id INTO v_mentioned_user FROM public.profiles WHERE LOWER(username) = LOWER(v_mention);
      IF v_mentioned_user IS NOT NULL AND v_mentioned_user <> NEW.author_id THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
        VALUES (v_mentioned_user, NEW.author_id, 'mention', NEW.id);
      END IF;
    END LOOP;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE public.posts SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_posts_change
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.trg_posts_sync();

CREATE OR REPLACE FUNCTION public.trg_follows_sync() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    INSERT INTO public.notifications (recipient_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follows_change
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.trg_follows_sync();

CREATE OR REPLACE FUNCTION public.trg_messages_sync() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.content, last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_messages_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_messages_sync();

-- ==========================================
-- 3. FEED & DM RPC FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_for_you_feed(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  author_username TEXT,
  author_display_name TEXT,
  author_avatar_url TEXT,
  content TEXT,
  media_urls TEXT[],
  parent_id UUID,
  quoted_post JSONB,
  like_count INT,
  repost_count INT,
  reply_count INT,
  created_at TIMESTAMPTZ,
  feed_time TIMESTAMPTZ,
  reposted_by_username TEXT,
  reposted_by_display_name TEXT,
  is_liked BOOLEAN,
  is_reposted BOOLEAN,
  is_bookmarked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    p.content,
    p.media_urls,
    p.parent_id,
    CASE WHEN qp.id IS NOT NULL THEN jsonb_build_object(
      'id', qp.id,
      'author_id', qp.author_id,
      'author_username', qpr.username,
      'author_display_name', qpr.display_name,
      'author_avatar_url', qpr.avatar_url,
      'content', qp.content,
      'media_urls', qp.media_urls,
      'created_at', qp.created_at
    ) ELSE NULL END AS quoted_post,
    p.like_count,
    p.repost_count,
    p.reply_count,
    p.created_at,
    p.created_at AS feed_time,
    NULL::TEXT AS reposted_by_username,
    NULL::TEXT AS reposted_by_display_name,
    EXISTS(SELECT 1 FROM public.likes l WHERE l.post_id = p.id AND l.user_id = p_user_id) AS is_liked,
    EXISTS(SELECT 1 FROM public.reposts r WHERE r.post_id = p.id AND r.user_id = p_user_id) AS is_reposted,
    EXISTS(SELECT 1 FROM public.bookmarks b WHERE b.post_id = p.id AND b.user_id = p_user_id) AS is_bookmarked
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  LEFT JOIN public.posts qp ON qp.id = p.quoted_post_id
  LEFT JOIN public.profiles qpr ON qpr.id = qp.author_id
  WHERE p.parent_id IS NULL
  ORDER BY
    ((p.like_count * 2.0 + p.repost_count * 3.0 + p.reply_count * 2.5 + 1.0)
     / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 0) + 2.0, 1.5)) DESC,
    p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_following_feed(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  author_username TEXT,
  author_display_name TEXT,
  author_avatar_url TEXT,
  content TEXT,
  media_urls TEXT[],
  parent_id UUID,
  quoted_post JSONB,
  like_count INT,
  repost_count INT,
  reply_count INT,
  created_at TIMESTAMPTZ,
  feed_time TIMESTAMPTZ,
  reposted_by_username TEXT,
  reposted_by_display_name TEXT,
  is_liked BOOLEAN,
  is_reposted BOOLEAN,
  is_bookmarked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH followed AS (
    SELECT following_id AS uid FROM public.follows WHERE follower_id = p_user_id
    UNION
    SELECT p_user_id AS uid
  ),
  feed_items AS (
    SELECT
      p.id AS post_id,
      p.created_at AS sort_time,
      NULL::TEXT AS rp_user,
      NULL::TEXT AS rp_name
    FROM public.posts p
    JOIN followed f ON f.uid = p.author_id
    WHERE p.parent_id IS NULL

    UNION ALL

    SELECT
      r.post_id,
      r.created_at AS sort_time,
      rpr.username AS rp_user,
      rpr.display_name AS rp_name
    FROM public.reposts r
    JOIN followed f ON f.uid = r.user_id
    JOIN public.profiles rpr ON rpr.id = r.user_id
  )
  SELECT
    p.id,
    p.author_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    p.content,
    p.media_urls,
    p.parent_id,
    CASE WHEN qp.id IS NOT NULL THEN jsonb_build_object(
      'id', qp.id,
      'author_id', qp.author_id,
      'author_username', qpr.username,
      'author_display_name', qpr.display_name,
      'author_avatar_url', qpr.avatar_url,
      'content', qp.content,
      'media_urls', qp.media_urls,
      'created_at', qp.created_at
    ) ELSE NULL END AS quoted_post,
    p.like_count,
    p.repost_count,
    p.reply_count,
    p.created_at,
    fi.sort_time AS feed_time,
    fi.rp_user AS reposted_by_username,
    fi.rp_name AS reposted_by_display_name,
    EXISTS(SELECT 1 FROM public.likes l WHERE l.post_id = p.id AND l.user_id = p_user_id) AS is_liked,
    EXISTS(SELECT 1 FROM public.reposts r WHERE r.post_id = p.id AND r.user_id = p_user_id) AS is_reposted,
    EXISTS(SELECT 1 FROM public.bookmarks b WHERE b.post_id = p.id AND b.user_id = p_user_id) AS is_bookmarked
  FROM feed_items fi
  JOIN public.posts p ON p.id = fi.post_id
  JOIN public.profiles pr ON pr.id = p.author_id
  LEFT JOIN public.posts qp ON qp.id = p.quoted_post_id
  LEFT JOIN public.profiles qpr ON qpr.id = qp.author_id
  ORDER BY fi.sort_time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_me UUID := auth.uid();
  v_p1 UUID := LEAST(v_me, p_other_user_id);
  v_p2 UUID := GREATEST(v_me, p_other_user_id);
  v_conv_id UUID;
BEGIN
  IF v_me = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot start conversation with yourself';
  END IF;

  INSERT INTO public.conversations (participant_1, participant_2)
  VALUES (v_p1, v_p2)
  ON CONFLICT (participant_1, participant_2) DO NOTHING;

  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE participant_1 = v_p1 AND participant_2 = v_p2;

  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_trending_hashtags(p_limit INT DEFAULT 10)
RETURNS TABLE (hashtag TEXT, post_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    LOWER((regexp_matches(content, '#([a-zA-Z0-9_]+)', 'g'))[1]) AS tag,
    COUNT(*)::BIGINT AS cnt
  FROM public.posts
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY tag
  ORDER BY cnt DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) & REALTIME
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Posts readable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users create own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users delete own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Likes readable" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users toggle own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Reposts readable" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Users toggle own reposts" ON public.reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reposts" ON public.reposts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Follows readable" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users remove own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "Bookmarks strictly private select" ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Bookmarks strictly private insert" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookmarks strictly private delete" ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Mark own notifications read" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "Participants read conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Participants read messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Send message as self" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipient mark message read" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Authenticated upload media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
CREATE POLICY "Owner delete media" ON storage.objects
  FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;