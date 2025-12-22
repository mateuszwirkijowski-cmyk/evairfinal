/*
  # Fix: Public Read Access to Profiles

  ## Problem
  Aktualna polityka RLS na tabeli `profiles` pozwala czytać TYLKO własny profil:
  ```
  USING (auth.uid() = id)
  ```
  
  To powoduje, że:
  - JOIN do profili innych użytkowników zwraca NULL
  - Autorzy wiadomości, postów, komentarzy wyświetlają się jako "Użytkownik"
  - Brak avatarów innych użytkowników
  - Niemożność rozpoczęcia prywatnej rozmowy (brak dostępu do profilu odbiorcy)

  ## Rozwiązanie
  Dodanie publicznego odczytu profili dla zalogowanych użytkowników.
  W aplikacji społecznościowej imiona i avatary MUSZĄ być publiczne.

  ## Zmiany
  1. Usunięcie restrykcyjnej polityki "Users can read own profile"
  2. Dodanie nowej polityki "Public read access to profiles" z USING (true)
  3. Zachowanie ochrony UPDATE - użytkownik może edytować TYLKO swój profil

  ## Bezpieczeństwo
  - SELECT: ✅ Publiczny dostęp (authenticated users)
  - UPDATE: ✅ Chronione (TYLKO własny profil)
  - DELETE: ✅ Brak dostępu (CASCADE z auth.users)
  - INSERT: ✅ Chronione (TYLKO własny profil przez trigger)
*/

-- Usunięcie starej restrykcyjnej polityki
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- FIX: Dodanie publicznego dostępu do odczytu profili
-- W aplikacji społecznościowej imiona i avatary MUSZĄ być publiczne
CREATE POLICY "Public read access to profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Weryfikacja: polityka UPDATE nadal chroni cudze profile
-- (nie trzeba zmieniać - już istnieje i jest poprawna)
