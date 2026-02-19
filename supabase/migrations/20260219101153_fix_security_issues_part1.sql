/*
  # Security Fixes Part 1: Indexes and Policy Cleanup

  ## Changes Made:
  
  ### 1. Index Performance
  - Add missing index on `training_modules.created_by` foreign key
  
  ### 2. Remove Duplicate and Problematic Policies
  - Remove all existing policies to avoid conflicts
  - Will recreate optimized policies in next migration
  
  ## Security Improvements:
  - Better query performance with proper indexing
  - Clean slate for policy optimization
*/

-- ============================================
-- 1. ADD MISSING INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_training_modules_created_by 
  ON training_modules(created_by);

-- ============================================
-- 2. DROP ALL EXISTING POLICIES
-- ============================================

-- Profiles policies
DROP POLICY IF EXISTS "Allow all" ON profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;

-- Conversations policies
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Conversation members can update" ON conversations;

-- Conversation members policies
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON conversation_members;
DROP POLICY IF EXISTS "Anyone can join public chat" ON conversation_members;
DROP POLICY IF EXISTS "Creator can add members or users can add themselves" ON conversation_members;
DROP POLICY IF EXISTS "Members can view other members" ON conversation_members;
DROP POLICY IF EXISTS "Users can leave conversations" ON conversation_members;

-- Messages policies
DROP POLICY IF EXISTS "Members can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Members can send messages as themselves" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Admins can update any message" ON messages;
DROP POLICY IF EXISTS "Admins can delete any message" ON messages;

-- BlaBla posts policies
DROP POLICY IF EXISTS "Authenticated users can read posts" ON blabla_posts;
DROP POLICY IF EXISTS "Authenticated users can read all posts" ON blabla_posts;
DROP POLICY IF EXISTS "Users can create own posts" ON blabla_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON blabla_posts;
DROP POLICY IF EXISTS "Admins can delete any post" ON blabla_posts;
DROP POLICY IF EXISTS "Users and admins can update posts" ON blabla_posts;
DROP POLICY IF EXISTS "Admins can update any post" ON blabla_posts;

-- BlaBla post attachments policies
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON blabla_post_attachments;
DROP POLICY IF EXISTS "Authenticated users can read all attachments" ON blabla_post_attachments;
DROP POLICY IF EXISTS "Post authors can create attachments" ON blabla_post_attachments;
DROP POLICY IF EXISTS "Post authors can delete attachments" ON blabla_post_attachments;
DROP POLICY IF EXISTS "Admins can delete any attachment" ON blabla_post_attachments;
DROP POLICY IF EXISTS "Admins can update any attachment" ON blabla_post_attachments;

-- BlaBla post likes policies
DROP POLICY IF EXISTS "Authenticated users can read post likes" ON blabla_post_likes;
DROP POLICY IF EXISTS "Users can create own post likes" ON blabla_post_likes;
DROP POLICY IF EXISTS "Users can delete own post likes" ON blabla_post_likes;

-- BlaBla comments policies
DROP POLICY IF EXISTS "Authenticated users can read comments" ON blabla_comments;
DROP POLICY IF EXISTS "Users can create own comments" ON blabla_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON blabla_comments;
DROP POLICY IF EXISTS "Admins can delete any comment" ON blabla_comments;
DROP POLICY IF EXISTS "Users and admins can update comments" ON blabla_comments;
DROP POLICY IF EXISTS "Admins can update any comment" ON blabla_comments;

-- BlaBla comment likes policies
DROP POLICY IF EXISTS "Authenticated users can read comment likes" ON blabla_comment_likes;
DROP POLICY IF EXISTS "Users can create own comment likes" ON blabla_comment_likes;
DROP POLICY IF EXISTS "Users can delete own comment likes" ON blabla_comment_likes;

-- UI texts policies
DROP POLICY IF EXISTS "Anyone can read UI texts" ON ui_texts;
DROP POLICY IF EXISTS "Admins can insert UI texts" ON ui_texts;
DROP POLICY IF EXISTS "Admins can update UI texts" ON ui_texts;
DROP POLICY IF EXISTS "Admins can delete UI texts" ON ui_texts;

-- Events policies
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Only admins can create events" ON events;
DROP POLICY IF EXISTS "Only admins can update events" ON events;
DROP POLICY IF EXISTS "Only admins can delete events" ON events;

-- Event participants policies
DROP POLICY IF EXISTS "Anyone can view participants" ON event_participants;
DROP POLICY IF EXISTS "Users can view own registrations, admins view all" ON event_participants;
DROP POLICY IF EXISTS "Authenticated users can sign up for events" ON event_participants;
DROP POLICY IF EXISTS "Users can unregister, admins can remove anyone" ON event_participants;

-- Announcements policies
DROP POLICY IF EXISTS "Anyone can read announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON announcements;

-- Training modules policies
DROP POLICY IF EXISTS "Authenticated users can view active modules" ON training_modules;
DROP POLICY IF EXISTS "Admins can insert modules" ON training_modules;
DROP POLICY IF EXISTS "Admins can update modules" ON training_modules;
DROP POLICY IF EXISTS "Admins can delete modules" ON training_modules;