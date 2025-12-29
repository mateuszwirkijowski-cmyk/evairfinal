/*
  # Admin User Management RLS Policies

  ## Overview
  This migration adds RLS policies to allow administrators to manage all user profiles.

  ## Security Changes

  ### profiles Table
  - Added policy: "Admins can select all profiles"
    - Allows admins to view all user profiles for user management
  - Added policy: "Admins can update all profiles"
    - Allows admins to update any user's role and profile information

  ## Important Notes
  - These policies are separate from existing user policies
  - Regular users can still only view/update their own profiles
  - Admin check is done via role='admin' in the profiles table
  - The email column already exists in profiles table (created in initial migration)
*/

-- Allow admins to select all profiles
CREATE POLICY "Admins can select all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Allow admins to update all profiles
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