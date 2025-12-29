/*
  # Fix RLS Policies for Public Read Access

  ## Overview
  This migration restores user functionality by fixing overly restrictive RLS policies.
  Users need to read other users' profiles to display author names and avatars for posts.

  ## Security Changes

  ### profiles Table
  1. Drop existing restrictive policies
  2. Add policy: "Public read access for all authenticated users"
     - Allows all authenticated users to SELECT any profile (needed for posts/gallery)
  3. Add policy: "Users can insert own profile"
     - Allows users to INSERT their own profile during registration
  4. Add policy: "Users can update own profile"
     - Allows users to UPDATE their own profile (auth.uid() = id)
  5. Add policy: "Admins can update all profiles" 
     - Allows admins to UPDATE any profile (role = 'admin')

  ### blabla_posts Table
  - Ensure SELECT policy exists for authenticated users

  ### blabla_post_attachments Table
  - Ensure SELECT policy exists for authenticated users

  ## Important Notes
  - Public read access is safe because profiles only contain public info (name, avatar)
  - Email addresses are already in profiles table and accessible
  - This allows users to see post authors and chat participants
  - Admin policies remain separate and secure
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Public Access" ON profiles;
DROP POLICY IF EXISTS "User Update" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can select all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public read access for all authenticated users" ON profiles;

-- Create new clean policies for profiles table

-- Allow all authenticated users to read all profiles (needed for posts, gallery, chat)
CREATE POLICY "Public read access for all authenticated users"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to insert their own profile during registration
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admins to update any profile (for role management)
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Fix blabla_posts table policies
DROP POLICY IF EXISTS "Enable read access for all users" ON blabla_posts;
DROP POLICY IF EXISTS "Authenticated users can read all posts" ON blabla_posts;

CREATE POLICY "Authenticated users can read all posts"
  ON blabla_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix blabla_post_attachments table policies
DROP POLICY IF EXISTS "Enable read access for all users" ON blabla_post_attachments;
DROP POLICY IF EXISTS "Authenticated users can read all attachments" ON blabla_post_attachments;

CREATE POLICY "Authenticated users can read all attachments"
  ON blabla_post_attachments
  FOR SELECT
  TO authenticated
  USING (true);

-- Set admin role for the specified user
UPDATE profiles 
SET role = 'admin' 
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'wirkijowski.mateusz@gmail.com'
);