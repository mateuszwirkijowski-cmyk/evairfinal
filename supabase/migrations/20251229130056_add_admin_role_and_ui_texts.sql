/*
  # Administrator Role and UI Text Management System

  ## Overview
  This migration adds an administrator role system and dynamic UI text management.

  ## Changes to Existing Tables
  
  ### profiles
  - Add `role` column (text, default 'user')
    - Possible values: 'user', 'admin'
    - Used to determine user permissions

  ## New Tables
  
  ### ui_texts
  - `id` (uuid, primary key)
  - `element_id` (text, unique) - identifier for UI element (e.g., 'channel_feed', 'header_gallery')
  - `content` (text) - the editable text content
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security Changes

  ### profiles Table
  - Added policy for all users to read all profiles (needed for admin checks)
  
  ### ui_texts Table
  - Enable RLS
  - All authenticated users can read
  - Only admins can insert, update, delete

  ### Content Tables (blabla_posts, blabla_comments, blabla_post_attachments, messages)
  - Added admin policies for full CRUD operations
  - Admins can perform all operations on any content

  ## Important Notes
  - Admin role grants full access to all content
  - UI texts are globally editable by admins
  - Role defaults to 'user' for all new accounts
*/

-- Add role column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- Create ui_texts table
CREATE TABLE IF NOT EXISTS ui_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id text UNIQUE NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on ui_texts
ALTER TABLE ui_texts ENABLE ROW LEVEL SECURITY;

-- ui_texts policies
CREATE POLICY "Anyone can read UI texts"
  ON ui_texts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert UI texts"
  ON ui_texts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update UI texts"
  ON ui_texts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete UI texts"
  ON ui_texts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add policy for all users to read all profiles (needed for admin checks and author display)
DROP POLICY IF EXISTS "All authenticated users can read profiles" ON profiles;
CREATE POLICY "All authenticated users can read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Trigger for ui_texts updated_at
DROP TRIGGER IF EXISTS on_ui_texts_updated ON ui_texts;
CREATE TRIGGER on_ui_texts_updated
  BEFORE UPDATE ON ui_texts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ADMIN POLICIES FOR CONTENT TABLES
-- ============================================

-- blabla_posts table - Admin full access
CREATE POLICY "Admins can delete any post"
  ON blabla_posts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any post"
  ON blabla_posts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- blabla_comments table - Admin full access
CREATE POLICY "Admins can delete any comment"
  ON blabla_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any comment"
  ON blabla_comments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- blabla_post_attachments table - Admin full access
CREATE POLICY "Admins can delete any attachment"
  ON blabla_post_attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any attachment"
  ON blabla_post_attachments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- messages table - Admin full access
CREATE POLICY "Admins can delete any message"
  ON messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any message"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default UI texts
INSERT INTO ui_texts (element_id, content) VALUES
  ('channel_feed', 'FEED'),
  ('channel_gallery', 'GALERIA'),
  ('channel_blabla', 'BLABLA'),
  ('channel_events', 'WYDARZENIA'),
  ('channel_training', 'SZKOLENIA')
ON CONFLICT (element_id) DO NOTHING;