/*
  # Dodanie funkcji pomocniczych do debugowania RLS

  ## Cel
  Umożliwienie debugowania problemów z RLS poprzez:
  1. Funkcję sprawdzającą aktualny auth.uid()
  2. Funkcję sprawdzającą członkostwo w rozmowie
  3. Logowanie prób INSERT

  ## Nowe funkcje
  - `debug_current_user()` - zwraca aktualny auth.uid()
  - `debug_conversation_access(conversation_id)` - sprawdza czy user ma dostęp
*/

-- Funkcja do sprawdzania aktualnego auth.uid() (użyteczna przy debugowaniu)
CREATE OR REPLACE FUNCTION debug_current_user()
RETURNS TABLE (
    current_user_id uuid,
    is_authenticated boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        auth.uid() as current_user_id,
        auth.uid() IS NOT NULL as is_authenticated;
END;
$$;

-- Funkcja do sprawdzania dostępu do konwersacji
CREATE OR REPLACE FUNCTION debug_conversation_access(conversation_uuid uuid)
RETURNS TABLE (
    conversation_id uuid,
    current_user_id uuid,
    is_member boolean,
    created_by uuid,
    is_creator boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as conversation_id,
        auth.uid() as current_user_id,
        is_conversation_member(c.id, auth.uid()) as is_member,
        c.created_by,
        (c.created_by = auth.uid()) as is_creator
    FROM conversations c
    WHERE c.id = conversation_uuid;
END;
$$;

-- Dodaj komentarz wyjaśniający
COMMENT ON FUNCTION debug_current_user() IS 'Funkcja pomocnicza do debugowania - zwraca aktualny auth.uid()';
COMMENT ON FUNCTION debug_conversation_access(uuid) IS 'Funkcja pomocnicza do debugowania - sprawdza dostęp do konwersacji';
