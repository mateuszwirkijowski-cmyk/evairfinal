/*
  # Dodanie kluczy obcych dla relacji z tabelą profiles

  ## Problem
  Supabase nie może znaleźć relacji między:
  - messages.sender_id → profiles.id
  - conversation_members.user_id → profiles.id
  
  To powoduje błędy przy zapytaniach z joinami.

  ## Rozwiązanie
  Dodanie foreign key constraints dla tych relacji.

  ## Zmiany
  1. Dodanie FK: messages.sender_id → profiles.id
  2. Dodanie FK: conversation_members.user_id → profiles.id
*/

-- Dodaj foreign key dla messages.sender_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_sender_id_fkey'
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Dodaj foreign key dla conversation_members.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'conversation_members_user_id_fkey'
    AND table_name = 'conversation_members'
  ) THEN
    ALTER TABLE conversation_members
    ADD CONSTRAINT conversation_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
