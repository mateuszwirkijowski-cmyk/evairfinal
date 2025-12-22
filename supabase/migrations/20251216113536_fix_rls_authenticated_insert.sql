/*
  # Fix RLS policy dla conversations INSERT
  
  1. Problem
    - Polityka WITH CHECK (true) była zbyt permissive
    - Request może być wykonywany jako anon mimo session w JS
    - auth.uid() może zwracać NULL w kontekście PostgREST
  
  2. Rozwiązanie
    - Sprawdzamy czy auth.uid() jest NOT NULL (user authenticated)
    - Sprawdzamy czy created_by = auth.uid() (security)
    - Frontend teraz wysyła created_by explicite
  
  3. Bezpieczeństwo
    - Tylko authenticated users (auth.uid() NOT NULL)
    - created_by musi być = auth.uid()
    - Nie można podszywać się pod innych userów
*/

-- DROP starej polityki
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;

-- Nowa polityka: wymaga authenticated user + created_by = auth.uid()
CREATE POLICY "Authenticated users can create conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  -- Sprawdź czy user jest authenticated
  auth.uid() IS NOT NULL
  -- I czy created_by pasuje do auth.uid()
  AND created_by = auth.uid()
);
