/*
  # Tabela profili użytkowników

  ## Opis
  Tabela przechowuje dodatkowe dane użytkowników powiązane z Supabase Auth.
  Automatycznie tworzy profil po rejestracji nowego użytkownika.

  ## Nowe tabele
    - `profiles`
      - `id` (uuid, primary key) - powiązanie z auth.users
      - `email` (text) - adres email użytkownika
      - `full_name` (text) - imię i nazwisko
      - `created_at` (timestamptz) - data utworzenia
      - `updated_at` (timestamptz) - data ostatniej aktualizacji

  ## Bezpieczeństwo
    - Enable RLS na tabeli `profiles`
    - Użytkownicy mogą czytać własny profil
    - Użytkownicy mogą aktualizować własny profil
    - Trigger automatycznie tworzy profil po rejestracji

  ## Uwagi
    - Profil jest tworzony automatycznie przez trigger
    - Email jest pobierany z auth.users
*/

-- Tworzenie tabeli profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Włączenie RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Użytkownicy mogą czytać własny profil
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Użytkownicy mogą aktualizować własny profil
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: System może wstawiać nowe profile (dla triggera)
CREATE POLICY "System can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Funkcja: Automatyczne tworzenie profilu po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Uruchamia funkcję po utworzeniu użytkownika
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Funkcja: Aktualizacja updated_at przy każdej zmianie
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Aktualizacja updated_at
DROP TRIGGER IF EXISTS on_profile_updated ON profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();