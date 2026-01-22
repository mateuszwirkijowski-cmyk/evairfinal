/*
  # Create Training Modules System
  
  This migration creates a comprehensive training module management system for administrators.
  
  1. New Tables
    - `training_modules`
      - `id` (uuid, primary key)
      - `title` (text) - Module name (e.g., "Moduł 1: Podstawy")
      - `order_index` (integer) - Display order
      - `content` (text) - Rich HTML content of the module
      - `video_url` (text, nullable) - URL to video file in storage
      - `pdf_url` (text, nullable) - URL to PDF file in storage
      - `embed_code` (text, nullable) - Embed iframe code
      - `is_active` (boolean) - Whether module is visible
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)
  
  2. Security
    - Enable RLS on `training_modules` table
    - All authenticated users can read active modules
    - Only admins can create, update, and delete modules
  
  3. Storage
    - Create storage bucket `training-files` for videos and PDFs
    - Only admins can upload files
    - All authenticated users can view files
*/

-- Create training_modules table
CREATE TABLE IF NOT EXISTS training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  content text DEFAULT '',
  video_url text,
  pdf_url text,
  embed_code text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

-- Policies for training_modules
CREATE POLICY "Authenticated users can view active modules"
  ON training_modules
  FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by = auth.uid() OR (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin');

CREATE POLICY "Admins can insert modules"
  ON training_modules
  FOR INSERT
  TO authenticated
  WITH CHECK ((
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin');

CREATE POLICY "Admins can update modules"
  ON training_modules
  FOR UPDATE
  TO authenticated
  USING ((
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin')
  WITH CHECK ((
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin');

CREATE POLICY "Admins can delete modules"
  ON training_modules
  FOR DELETE
  TO authenticated
  USING ((
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin');

-- Create storage bucket for training files
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-files', 'training-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for training-files bucket
CREATE POLICY "Authenticated users can view training files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'training-files');

CREATE POLICY "Admins can upload training files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'training-files' 
    AND (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'
  );

CREATE POLICY "Admins can update training files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'training-files'
    AND (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'
  );

CREATE POLICY "Admins can delete training files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'training-files'
    AND (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'
  );

-- Insert default training modules
INSERT INTO training_modules (title, order_index, content, is_active) VALUES
  ('Moduł 1: Podstawy', 1, '<h2>Moduł 1: Podstawy</h2><p>Wprowadzenie wideo do kursu.</p>', true),
  ('Moduł 2: Bezpieczeństwo', 2, '<h2>Moduł 2: Bezpieczeństwo</h2><p>Zasady BHP w lotnictwie.</p>', true),
  ('Moduł 3: Rezerwacje', 3, '<h2>Moduł 3: Rezerwacje</h2><p>Instruktaż kalendarza.</p>', true)
ON CONFLICT DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_training_modules_order ON training_modules(order_index);
CREATE INDEX IF NOT EXISTS idx_training_modules_active ON training_modules(is_active);