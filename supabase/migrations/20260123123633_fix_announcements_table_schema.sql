/*
  # Fix Announcements Table Schema and Add Admin CRUD

  ## Overview
  This migration fixes the announcements table schema to support the admin CRUD interface
  and adds proper RLS policies.

  ## Changes Made

  ### announcements Table Schema Changes
  - Add `title` column (text, required) - announcement title
  - Add `tag` column (text, required) - announcement category tag (Ważne, Techniczne, Informacja)
  - Keep existing columns: id, created_at, updated_at, content, media_url, media_type, author_id

  ### Security (RLS Policies)
  - All authenticated users can read announcements
  - Only admins can create announcements
  - Only admins can update announcements
  - Only admins can delete announcements

  ## Important Notes
  - Admins have full CRUD access to announcements
  - Regular users can only view announcements
  - The tag field is constrained to specific values for consistency
*/

-- Add title and tag columns to announcements table
DO $$
BEGIN
  -- Add title column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'announcements' AND column_name = 'title'
  ) THEN
    ALTER TABLE announcements ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;

  -- Add tag column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'announcements' AND column_name = 'tag'
  ) THEN
    ALTER TABLE announcements ADD COLUMN tag text NOT NULL DEFAULT 'Informacja';
    ALTER TABLE announcements ADD CONSTRAINT announcements_tag_check 
      CHECK (tag IN ('Ważne', 'Techniczne', 'Informacja'));
  END IF;
END $$;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "All authenticated users can read announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON announcements;

-- Create RLS policies for announcements
CREATE POLICY "All authenticated users can read announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert announcements"
  ON announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update announcements"
  ON announcements
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

CREATE POLICY "Admins can delete announcements"
  ON announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add trigger for updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_announcements_updated'
  ) THEN
    CREATE TRIGGER on_announcements_updated
      BEFORE UPDATE ON announcements
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
