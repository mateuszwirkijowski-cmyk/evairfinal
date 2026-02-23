/*
  # Password Reset Tokens System

  1. New Tables
    - `password_reset_tokens`
      - `id` (uuid, primary key) - Unique token identifier
      - `user_id` (uuid, foreign key) - References auth.users
      - `token` (text, unique) - Reset token sent via email
      - `email` (text) - User's email address
      - `expires_at` (timestamptz) - Token expiration time (1 hour from creation)
      - `used` (boolean) - Whether token has been used
      - `created_at` (timestamptz) - Creation timestamp
  
  2. Security
    - Enable RLS on `password_reset_tokens` table
    - Add restrictive policy - only service role can access
    - Prevents direct user access to tokens
    - Tokens managed only through Edge Functions
  
  3. Notes
    - Tokens expire after 1 hour automatically
    - Single-use tokens (marked as used after password reset)
    - CASCADE delete when user is deleted
*/

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON password_reset_tokens
  USING (false);