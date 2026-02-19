/*
  # Add WhatsApp webhook support to announcements

  1. Changes to announcements table
    - Add `sent_from_whatsapp` column (boolean, default false)
    - Make `author_id` nullable (to support bot-created announcements)
  
  2. Security
    - Update RLS policies to allow public inserts from edge function
    - Maintain existing read/update/delete policies
  
  3. Notes
    - NULL author_id indicates announcement from WhatsApp bot
    - sent_from_whatsapp=true marks bot-created content
*/

-- Add sent_from_whatsapp column
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS sent_from_whatsapp boolean DEFAULT false;

-- Make author_id nullable for bot announcements
ALTER TABLE announcements 
ALTER COLUMN author_id DROP NOT NULL;

-- Allow edge function (service role) to insert announcements
DROP POLICY IF EXISTS "Allow service role to insert announcements" ON announcements;
CREATE POLICY "Allow service role to insert announcements"
  ON announcements
  FOR INSERT
  TO service_role
  WITH CHECK (true);