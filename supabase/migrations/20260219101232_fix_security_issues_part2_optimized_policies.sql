/*
  # Security Fixes Part 2: Optimized RLS Policies

  ## Changes Made:
  
  ### RLS Policy Optimization
  - All policies use `(SELECT auth.uid())` instead of `auth.uid()`
  - This prevents re-evaluation for each row, dramatically improving performance
  - Proper restrictive policies without bypasses
  - Single policy per operation to avoid conflicts
  
  ## Security Improvements:
  - Optimal query performance at scale
  - No auth function re-evaluation overhead
  - Proper access control without unrestricted policies
*/

-- PROFILES: Public read, users can manage own, admins can manage all
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- CONVERSATIONS: Members can view and update
CREATE POLICY "conversations_select_member"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversations.id 
      AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "conversations_insert_auth"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "conversations_update_member"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversations.id 
      AND user_id = (SELECT auth.uid())
    )
  );

-- CONVERSATION_MEMBERS: Members can view, creator/self can add, users can leave
CREATE POLICY "conversation_members_select_member"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id 
      AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "conversation_members_insert_creator_or_self"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id 
      AND created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "conversation_members_delete_self"
  ON conversation_members FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- MESSAGES: Members can view/send, users can update/delete own, admins can manage
CREATE POLICY "messages_select_member"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id 
      AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "messages_insert_member"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id 
      AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "messages_update_own_or_admin"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    sender_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "messages_delete_admin"
  ON messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- BLABLA_POSTS: Public read, users create/manage own, admins manage all
CREATE POLICY "blabla_posts_select_all"
  ON blabla_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "blabla_posts_insert_own"
  ON blabla_posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

CREATE POLICY "blabla_posts_update_own_or_admin"
  ON blabla_posts FOR UPDATE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "blabla_posts_delete_own_or_admin"
  ON blabla_posts FOR DELETE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- BLABLA_POST_ATTACHMENTS: Public read, post authors create/delete, admins delete
CREATE POLICY "blabla_post_attachments_select_all"
  ON blabla_post_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "blabla_post_attachments_insert_author"
  ON blabla_post_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM blabla_posts
      WHERE id = post_id 
      AND author_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "blabla_post_attachments_delete_author_or_admin"
  ON blabla_post_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM blabla_posts
      WHERE id = post_id 
      AND author_id = (SELECT auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- BLABLA_POST_LIKES: Public read, users manage own likes
CREATE POLICY "blabla_post_likes_select_all"
  ON blabla_post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "blabla_post_likes_insert_own"
  ON blabla_post_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "blabla_post_likes_delete_own"
  ON blabla_post_likes FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- BLABLA_COMMENTS: Public read, users create/manage own, admins manage all
CREATE POLICY "blabla_comments_select_all"
  ON blabla_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "blabla_comments_insert_own"
  ON blabla_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

CREATE POLICY "blabla_comments_update_own_or_admin"
  ON blabla_comments FOR UPDATE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "blabla_comments_delete_own_or_admin"
  ON blabla_comments FOR DELETE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- BLABLA_COMMENT_LIKES: Public read, users manage own likes
CREATE POLICY "blabla_comment_likes_select_all"
  ON blabla_comment_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "blabla_comment_likes_insert_own"
  ON blabla_comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "blabla_comment_likes_delete_own"
  ON blabla_comment_likes FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- UI_TEXTS: Public read, admins manage
CREATE POLICY "ui_texts_select_all"
  ON ui_texts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ui_texts_insert_admin"
  ON ui_texts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "ui_texts_update_admin"
  ON ui_texts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "ui_texts_delete_admin"
  ON ui_texts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- EVENTS: Public read, admins manage
CREATE POLICY "events_select_all"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "events_insert_admin"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "events_update_admin"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "events_delete_admin"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- EVENT_PARTICIPANTS: Public read, users sign up, users/admins delete
CREATE POLICY "event_participants_select_all"
  ON event_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "event_participants_insert_self"
  ON event_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "event_participants_delete_self_or_admin"
  ON event_participants FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ANNOUNCEMENTS: Public read, admins manage
CREATE POLICY "announcements_select_all"
  ON announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "announcements_insert_admin"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "announcements_update_admin"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "announcements_delete_admin"
  ON announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- TRAINING_MODULES: Users view active, admins manage all
CREATE POLICY "training_modules_select_active_or_admin"
  ON training_modules FOR SELECT
  TO authenticated
  USING (
    is_active = true OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "training_modules_insert_admin"
  ON training_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "training_modules_update_admin"
  ON training_modules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "training_modules_delete_admin"
  ON training_modules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );