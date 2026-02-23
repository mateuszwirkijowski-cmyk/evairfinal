/*
  # Add media upload and pinning to announcements
  
  1. Changes to announcements table
    - Add `is_pinned` (boolean) column for pinning announcements to sidebar
  
  2. New Tables
    - `announcement_attachments`
      - `id` (uuid, primary key)
      - `announcement_id` (uuid, foreign key to announcements)
      - `type` (text) - 'image', 'video', 'gif', 'file'
      - `url` (text) - full public URL from Storage
      - `filename` (text) - original filename
      - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on `announcement_attachments` table
    - Add policy for authenticated users to view attachments
    - Add policy for admins to insert/delete attachments
    - Add policy for service role to manage attachments (webhook support)
*/

-- 1. Add is_pinned column to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 2. Create announcement_attachments table
CREATE TABLE IF NOT EXISTS announcement_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  filename text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. RLS for announcement_attachments
ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments"
  ON announcement_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert attachments"
  ON announcement_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete attachments"
  ON announcement_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 4. Service role can also insert attachments (for future webhook support)
CREATE POLICY "Service role full access attachments"
  ON announcement_attachments FOR ALL
  TO service_role USING (true);