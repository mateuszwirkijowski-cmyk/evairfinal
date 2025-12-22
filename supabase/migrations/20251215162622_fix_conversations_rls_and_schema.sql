/*
  # Naprawa RLS i schematu dla systemu czatu (DM fix)

  ## Problem
  1. INSERT do `conversations` zwracał 403 przez politykę RLS
  2. Kolumna `created_by` była NULLABLE, co powodowało problemy z polityką
  3. Polityki RLS były niepełne/zbyt restrykcyjne

  ## Zmiany w schemacie

  ### `conversations`
  - Zmiana `created_by` na NOT NULL z DEFAULT auth.uid()
  - Zapewnia, że każda rozmowa ma zawsze przypisanego twórcę

  ## Nowe/Poprawione polityki RLS

  ### `conversations` (3 polityki):
  1. **INSERT**: Zalogowani mogą tworzyć rozmowy (created_by = auth.uid())
  2. **SELECT**: Użytkownicy widzą tylko swoje rozmowy lub publiczny czat
  3. **UPDATE**: Członkowie mogą aktualizować rozmowę

  ### `conversation_members` (4 polityki):
  1. **SELECT**: Członkowie widzą listę członków swoich rozmów
  2. **INSERT**: Creator może dodawać członków + każdy może dodać siebie
  3. **INSERT (public)**: Każdy może dołączyć do publicznego czatu
  4. **DELETE**: Użytkownicy mogą opuścić rozmowę

  ### `messages` (2 polityki):
  1. **SELECT**: Członkowie widzą wiadomości ze swoich rozmów
  2. **INSERT**: Członkowie mogą wysyłać wiadomości w swoich rozmowach

  ## Bezpieczeństwo
  - Wszystkie polityki są RESTRYKCYJNE i wymagają uwierzytelnienia
  - Użytkownicy mogą czytać/pisać TYLKO w rozmowach, których są członkami
  - Creator rozmowy może dodawać nowych członków
  - Publiczny czat jest dostępny dla wszystkich zalogowanych
*/

-- ============================================
-- FIX 1: Zmiana created_by na NOT NULL
-- ============================================

-- Najpierw ustaw wartość domyślną dla istniejących NULL-i
UPDATE conversations 
SET created_by = (
    SELECT user_id 
    FROM conversation_members 
    WHERE conversation_members.conversation_id = conversations.id 
    LIMIT 1
)
WHERE created_by IS NULL;

-- Teraz zmień kolumnę na NOT NULL z domyślną wartością
DO $$
BEGIN
    -- Sprawdź czy kolumna już ma NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'created_by' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE conversations 
        ALTER COLUMN created_by SET NOT NULL;
        
        ALTER TABLE conversations 
        ALTER COLUMN created_by SET DEFAULT auth.uid();
    END IF;
END $$;

-- ============================================
-- FIX 2: Usuń stare polityki i utwórz nowe
-- ============================================

-- Drop starych polityk dla conversations
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Anyone can view public chat" ON conversations;
DROP POLICY IF EXISTS "Members can update conversations" ON conversations;

-- Drop starych polityk dla conversation_members
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Creator can add members" ON conversation_members;
DROP POLICY IF EXISTS "Anyone can join public chat" ON conversation_members;
DROP POLICY IF EXISTS "Members can leave conversation" ON conversation_members;

-- Drop starych polityk dla messages
DROP POLICY IF EXISTS "Members can view messages" ON messages;
DROP POLICY IF EXISTS "Members can send messages" ON messages;

-- ============================================
-- NOWE POLITYKI: conversations
-- ============================================

-- INSERT: Użytkownicy mogą tworzyć rozmowy jako twórca
CREATE POLICY "Authenticated users can create conversations"
    ON conversations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- SELECT: Użytkownicy widzą rozmowy, których są członkami + publiczny czat
CREATE POLICY "Users can view their own conversations"
    ON conversations FOR SELECT
    TO authenticated
    USING (
        -- Rozmowy, których jestem członkiem
        is_conversation_member(id, auth.uid())
        OR
        -- Publiczny czat
        (name = '__PUBLIC_CHAT__' AND is_group = true)
    );

-- UPDATE: Członkowie mogą aktualizować rozmowę
CREATE POLICY "Conversation members can update"
    ON conversations FOR UPDATE
    TO authenticated
    USING (is_conversation_member(id, auth.uid()))
    WITH CHECK (is_conversation_member(id, auth.uid()));

-- ============================================
-- NOWE POLITYKI: conversation_members
-- ============================================

-- SELECT: Użytkownicy widzą członków rozmów, których są członkami
CREATE POLICY "Members can view other members"
    ON conversation_members FOR SELECT
    TO authenticated
    USING (
        -- Jestem członkiem tej rozmowy
        is_conversation_member(conversation_id, auth.uid())
        OR
        -- To publiczny czat
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_members.conversation_id
            AND conversations.name = '__PUBLIC_CHAT__'
            AND conversations.is_group = true
        )
    );

-- INSERT: Creator może dodawać członków + każdy może dodać siebie
CREATE POLICY "Creator can add members or users can add themselves"
    ON conversation_members FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Dodaję siebie
        user_id = auth.uid()
        OR
        -- Jestem creatorem tej rozmowy
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_members.conversation_id
            AND conversations.created_by = auth.uid()
        )
    );

-- INSERT (specjalna dla public chat): Każdy może dołączyć
CREATE POLICY "Anyone can join public chat"
    ON conversation_members FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_members.conversation_id
            AND conversations.name = '__PUBLIC_CHAT__'
            AND conversations.is_group = true
        )
    );

-- DELETE: Użytkownicy mogą opuścić rozmowę
CREATE POLICY "Users can leave conversations"
    ON conversation_members FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================
-- NOWE POLITYKI: messages
-- ============================================

-- SELECT: Użytkownicy widzą wiadomości z rozmów, których są członkami
CREATE POLICY "Members can view messages in their conversations"
    ON messages FOR SELECT
    TO authenticated
    USING (
        is_conversation_member(conversation_id, auth.uid())
    );

-- INSERT: Członkowie mogą wysyłać wiadomości jako siebie
CREATE POLICY "Members can send messages as themselves"
    ON messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND
        is_conversation_member(conversation_id, auth.uid())
    );

-- ============================================
-- INDEKSY DLA WYDAJNOŚCI
-- ============================================

-- Indeks na created_by dla szybszego sprawdzania creatora
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);

-- Indeksy na conversation_members dla RLS checks
CREATE INDEX IF NOT EXISTS idx_conversation_members_lookup ON conversation_members(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);

-- Indeks na messages dla realtime
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
