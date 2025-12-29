/*
  # Create Events System with Role-Based Access Control

  1. New Tables
    - `events`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz, default now())
      - `title` (text, required)
      - `description` (text)
      - `event_date` (timestamptz, required)
      - `is_open` (boolean, default true - determines if registrations are open)
      - `created_by` (uuid, foreign key to profiles)
    
    - `event_participants`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events)
      - `user_id` (uuid, foreign key to profiles)
      - `registered_at` (timestamptz, default now())
      - Unique constraint on (event_id, user_id) to prevent duplicate registrations

  2. Security Policies (RLS)
    
    **events table:**
    - SELECT: All authenticated users can view events
    - INSERT: Only admins can create events (role = 'admin' in profiles)
    - UPDATE: Only admins can modify events
    - DELETE: Only admins can delete events
    
    **event_participants table:**
    - SELECT: Users can see their own registrations, admins can see all
    - INSERT: Authenticated users can sign themselves up
    - DELETE: Users can unregister themselves, admins can remove anyone

  3. Notes
    - Events are public to all authenticated users
    - Only admins can create and manage events
    - Users can self-register for open events
    - Admins can view all participants and manage registrations
*/

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  is_open boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create event_participants table
CREATE TABLE IF NOT EXISTS event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR EVENTS TABLE
-- ============================================

-- SELECT: All authenticated users can view events
CREATE POLICY "Authenticated users can view all events"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only admins can create events
CREATE POLICY "Only admins can create events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- UPDATE: Only admins can update events
CREATE POLICY "Only admins can update events"
  ON events
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

-- DELETE: Only admins can delete events
CREATE POLICY "Only admins can delete events"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR EVENT_PARTICIPANTS TABLE
-- ============================================

-- SELECT: Users can see their own registrations, admins can see all
CREATE POLICY "Users can view own registrations, admins view all"
  ON event_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- INSERT: Authenticated users can sign up for events
CREATE POLICY "Authenticated users can sign up for events"
  ON event_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- DELETE: Users can unregister themselves, admins can remove anyone
CREATE POLICY "Users can unregister, admins can remove anyone"
  ON event_participants
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );