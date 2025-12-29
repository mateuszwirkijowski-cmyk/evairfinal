/*
  # Fix Chat RLS Insert Policies

  1. Changes to `conversations` table
    - Drop existing INSERT policy
    - Create new INSERT policy allowing all authenticated users to create conversations

  2. Changes to `conversation_members` table  
    - Drop existing INSERT policy
    - Create new INSERT policy allowing all authenticated users to add members

  ## Security
  - Both policies now use simple `auth.role() = 'authenticated'` check
  - This allows any logged-in user to create conversations and add members
*/

-- Drop existing INSERT policies on conversations table
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;

-- Create new INSERT policy for conversations
CREATE POLICY "Allow authenticated users to create conversations" 
  ON conversations 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Drop existing INSERT policies on conversation_members table
DROP POLICY IF EXISTS "Users can add members to conversations they created" ON conversation_members;
DROP POLICY IF EXISTS "Users can insert conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Authenticated users can add members" ON conversation_members;

-- Create new INSERT policy for conversation_members
CREATE POLICY "Allow authenticated users to add members" 
  ON conversation_members 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');