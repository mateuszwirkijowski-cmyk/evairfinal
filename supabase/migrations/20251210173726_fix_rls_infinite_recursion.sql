/*
  # Naprawa nieskończonej rekursji w politykach RLS

  ## Problem
  Polityka "Members can view conversation members" powodowała nieskończoną rekursję,
  sprawdzając conversation_members wewnątrz polityki na conversation_members.

  ## Rozwiązanie
  1. Utworzenie funkcji pomocniczej is_conversation_member()
  2. Przepisanie polityk używających tej funkcji zamiast rekurencyjnych zapytań

  ## Zmiany
  - Dodanie funkcji is_conversation_member(conversation_uuid, user_uuid)
  - Aktualizacja polityk dla conversation_members
  - Aktualizacja polityk dla conversations używających bezpieczniejszej logiki
*/

-- Funkcja sprawdzająca czy użytkownik jest członkiem konwersacji
CREATE OR REPLACE FUNCTION is_conversation_member(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conversation_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usunięcie starych polityk
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Members can update conversations" ON conversations;

-- Nowa polityka dla conversation_members - bez rekursji
CREATE POLICY "Members can view conversation members"
  ON conversation_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_conversation_member(conversation_id, auth.uid())
  );

-- Nowa polityka dla conversations - używa funkcji
CREATE POLICY "Users can view their conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    is_conversation_member(id, auth.uid())
  );

CREATE POLICY "Members can update conversations"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (
    is_conversation_member(id, auth.uid())
  );
