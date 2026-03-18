/*
  # Create activation_tokens table

  1. New Tables
    - `activation_tokens`
      - `id` (uuid, primary key)
      - `email` (text, not null)
      - `token` (text, unique, not null)
      - `expires_at` (timestamptz, not null)
      - `used` (boolean, default false)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `activation_tokens` table
    - Add restrictive policy (service role only via USING false)
*/

CREATE TABLE IF NOT EXISTS activation_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE activation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON activation_tokens
    USING (false);
