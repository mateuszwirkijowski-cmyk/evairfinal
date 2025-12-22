/*
  # Polityki dla publicznego czatu

  ## Problem
  Publiczny czat "__PUBLIC_CHAT__" nie może być tworzony ani wyświetlany
  przez użytkowników, ponieważ polityki RLS tego nie pozwalają.

  ## Rozwiązanie
  Dodanie specjalnych polityk dla publicznego czatu, które:
  1. Pozwalają wszystkim zalogowanym użytkownikom widzieć publiczny czat
  2. Pozwalają pierwszemu użytkownikowi utworzyć publiczny czat
  3. Pozwalają każdemu zalogowanemu użytkownikowi dołączyć do publicznego czatu

  ## Zmiany
  - Dodanie polityki SELECT dla publicznego czatu na conversations
  - Dodanie polityki INSERT dla członków publicznego czatu
*/

-- Polityka pozwalająca wszystkim widzieć publiczny czat
DROP POLICY IF EXISTS "Anyone can view public chat" ON conversations;
CREATE POLICY "Anyone can view public chat"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    name = '__PUBLIC_CHAT__' AND is_group = true
  );

-- Polityka pozwalająca każdemu dołączyć do publicznego czatu
DROP POLICY IF EXISTS "Anyone can join public chat" ON conversation_members;
CREATE POLICY "Anyone can join public chat"
  ON conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_members.conversation_id
      AND conversations.name = '__PUBLIC_CHAT__'
      AND conversations.is_group = true
    )
  );
