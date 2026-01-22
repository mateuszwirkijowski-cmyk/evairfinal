/*
  # Fix Profiles RLS for Initialization

  ## Overview
  This migration ensures profiles table has safe, non-recursive RLS policies
  that allow users to load their profiles without encountering infinite loops.

  ## Changes
  1. Ensure "Public read access for all authenticated users" policy exists
  2. Ensure "System can insert profiles" policy exists for trigger
  3. Keep other policies intact

  ## Security Notes
  - All authenticated users can read all profiles (safe for social app)
  - Users can only update their own profiles
  - Admins can update any profile
  - System can insert profiles via trigger
*/

-- Ensure base policies exist and are not recursive

-- Drop and recreate the public read policy to be absolutely certain
DROP POLICY IF EXISTS "Public read access for all authenticated users" ON profiles;

CREATE POLICY "Public read access for all authenticated users"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure system can insert profiles (for trigger during registration)
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;

CREATE POLICY "System can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
