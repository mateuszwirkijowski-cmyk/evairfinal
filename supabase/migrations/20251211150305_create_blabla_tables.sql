/*
  # System BlaBlaAir - Tablica postów społecznościowych

  ## Opis zmian
  Dodanie pełnego systemu postów w stylu Facebooka dla sekcji BlaBlaAir.
  Użytkownicy mogą tworzyć posty z załącznikami, komentować i lajkować.

  ## Nowe tabele
  
  ### `blabla_posts`
  Główna tabela postów:
  - `id` (uuid, primary key)
  - `author_id` (uuid, foreign key → profiles.id) - autor posta
  - `content` (text) - treść posta
  - `created_at` (timestamptz) - data utworzenia
  - `updated_at` (timestamptz) - data ostatniej modyfikacji
  
  ### `blabla_post_attachments`
  Załączniki do postów (zdjęcia, GIFy, filmy):
  - `id` (uuid, primary key)
  - `post_id` (uuid, foreign key → blabla_posts.id)
  - `type` (text) - typ załącznika: 'image', 'gif', 'video', 'file'
  - `url` (text) - URL do pliku w storage
  - `filename` (text) - oryginalna nazwa pliku
  - `created_at` (timestamptz)
  
  ### `blabla_post_likes`
  Polubienia postów:
  - `id` (uuid, primary key)
  - `post_id` (uuid, foreign key → blabla_posts.id)
  - `user_id` (uuid, foreign key → profiles.id)
  - `created_at` (timestamptz)
  - Constraint: jeden użytkownik może polubić post tylko raz
  
  ### `blabla_comments`
  Komentarze do postów:
  - `id` (uuid, primary key)
  - `post_id` (uuid, foreign key → blabla_posts.id)
  - `author_id` (uuid, foreign key → profiles.id)
  - `content` (text) - treść komentarza
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `blabla_comment_likes`
  Polubienia komentarzy:
  - `id` (uuid, primary key)
  - `comment_id` (uuid, foreign key → blabla_comments.id)
  - `user_id` (uuid, foreign key → profiles.id)
  - `created_at` (timestamptz)
  - Constraint: jeden użytkownik może polubić komentarz tylko raz

  ## Bezpieczeństwo (RLS)
  
  ### Polityki dla `blabla_posts`:
  1. SELECT: Wszyscy zalogowani użytkownicy mogą czytać posty
  2. INSERT: Użytkownicy mogą tworzyć posty jako siebie
  3. UPDATE: Użytkownicy mogą edytować tylko swoje posty
  4. DELETE: Użytkownicy mogą usuwać tylko swoje posty
  
  ### Polityki dla `blabla_post_attachments`:
  1. SELECT: Wszyscy zalogowani mogą czytać załączniki
  2. INSERT: Tylko autor posta może dodawać załączniki
  3. DELETE: Tylko autor posta może usuwać załączniki
  
  ### Polityki dla `blabla_post_likes`:
  1. SELECT: Wszyscy zalogowani mogą czytać polubienia
  2. INSERT: Użytkownicy mogą lajkować jako siebie
  3. DELETE: Użytkownicy mogą usuwać tylko swoje lajki
  
  ### Polityki dla `blabla_comments`:
  1. SELECT: Wszyscy zalogowani mogą czytać komentarze
  2. INSERT: Użytkownicy mogą komentować jako siebie
  3. UPDATE: Użytkownicy mogą edytować tylko swoje komentarze
  4. DELETE: Użytkownicy mogą usuwać tylko swoje komentarze
  
  ### Polityki dla `blabla_comment_likes`:
  1. SELECT: Wszyscy zalogowani mogą czytać polubienia
  2. INSERT: Użytkownicy mogą lajkować jako siebie
  3. DELETE: Użytkownicy mogą usuwać tylko swoje lajki

  ## Indeksy
  Dodano indeksy dla optymalizacji wydajności:
  - `blabla_posts.author_id`
  - `blabla_posts.created_at`
  - `blabla_post_attachments.post_id`
  - `blabla_post_likes.post_id`
  - `blabla_post_likes.user_id`
  - `blabla_comments.post_id`
  - `blabla_comments.author_id`
  - `blabla_comment_likes.comment_id`
  - `blabla_comment_likes.user_id`
*/

-- ============================================
-- TWORZENIE TABEL
-- ============================================

-- Tabela postów
CREATE TABLE IF NOT EXISTS blabla_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tabela załączników do postów
CREATE TABLE IF NOT EXISTS blabla_post_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES blabla_posts(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('image', 'gif', 'video', 'file')),
    url text NOT NULL,
    filename text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Tabela polubień postów
CREATE TABLE IF NOT EXISTS blabla_post_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES blabla_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- Tabela komentarzy
CREATE TABLE IF NOT EXISTS blabla_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES blabla_posts(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tabela polubień komentarzy
CREATE TABLE IF NOT EXISTS blabla_comment_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES blabla_comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(comment_id, user_id)
);

-- ============================================
-- INDEKSY DLA WYDAJNOŚCI
-- ============================================

CREATE INDEX IF NOT EXISTS idx_blabla_posts_author ON blabla_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blabla_posts_created ON blabla_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blabla_attachments_post ON blabla_post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_blabla_post_likes_post ON blabla_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_blabla_post_likes_user ON blabla_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_blabla_comments_post ON blabla_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_blabla_comments_author ON blabla_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_blabla_comments_created ON blabla_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blabla_comment_likes_comment ON blabla_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_blabla_comment_likes_user ON blabla_comment_likes(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Włącz RLS dla wszystkich tabel
ALTER TABLE blabla_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blabla_post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blabla_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blabla_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blabla_comment_likes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLITYKI RLS DLA POSTÓW
-- ============================================

-- Wszyscy zalogowani mogą czytać posty
CREATE POLICY "Authenticated users can read posts"
    ON blabla_posts FOR SELECT
    TO authenticated
    USING (true);

-- Użytkownicy mogą tworzyć posty jako siebie
CREATE POLICY "Users can create own posts"
    ON blabla_posts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

-- Użytkownicy mogą edytować tylko swoje posty
CREATE POLICY "Users can update own posts"
    ON blabla_posts FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- Użytkownicy mogą usuwać tylko swoje posty
CREATE POLICY "Users can delete own posts"
    ON blabla_posts FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);

-- ============================================
-- POLITYKI RLS DLA ZAŁĄCZNIKÓW
-- ============================================

-- Wszyscy zalogowani mogą czytać załączniki
CREATE POLICY "Authenticated users can read attachments"
    ON blabla_post_attachments FOR SELECT
    TO authenticated
    USING (true);

-- Tylko autor posta może dodawać załączniki
CREATE POLICY "Post authors can create attachments"
    ON blabla_post_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM blabla_posts
            WHERE blabla_posts.id = post_id
            AND blabla_posts.author_id = auth.uid()
        )
    );

-- Tylko autor posta może usuwać załączniki
CREATE POLICY "Post authors can delete attachments"
    ON blabla_post_attachments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM blabla_posts
            WHERE blabla_posts.id = post_id
            AND blabla_posts.author_id = auth.uid()
        )
    );

-- ============================================
-- POLITYKI RLS DLA POLUBIEŃ POSTÓW
-- ============================================

-- Wszyscy zalogowani mogą czytać polubienia
CREATE POLICY "Authenticated users can read post likes"
    ON blabla_post_likes FOR SELECT
    TO authenticated
    USING (true);

-- Użytkownicy mogą lajkować jako siebie
CREATE POLICY "Users can create own post likes"
    ON blabla_post_likes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Użytkownicy mogą usuwać tylko swoje lajki
CREATE POLICY "Users can delete own post likes"
    ON blabla_post_likes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================
-- POLITYKI RLS DLA KOMENTARZY
-- ============================================

-- Wszyscy zalogowani mogą czytać komentarze
CREATE POLICY "Authenticated users can read comments"
    ON blabla_comments FOR SELECT
    TO authenticated
    USING (true);

-- Użytkownicy mogą komentować jako siebie
CREATE POLICY "Users can create own comments"
    ON blabla_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

-- Użytkownicy mogą edytować tylko swoje komentarze
CREATE POLICY "Users can update own comments"
    ON blabla_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- Użytkownicy mogą usuwać tylko swoje komentarze
CREATE POLICY "Users can delete own comments"
    ON blabla_comments FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);

-- ============================================
-- POLITYKI RLS DLA POLUBIEŃ KOMENTARZY
-- ============================================

-- Wszyscy zalogowani mogą czytać polubienia komentarzy
CREATE POLICY "Authenticated users can read comment likes"
    ON blabla_comment_likes FOR SELECT
    TO authenticated
    USING (true);

-- Użytkownicy mogą lajkować komentarze jako siebie
CREATE POLICY "Users can create own comment likes"
    ON blabla_comment_likes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Użytkownicy mogą usuwać tylko swoje lajki komentarzy
CREATE POLICY "Users can delete own comment likes"
    ON blabla_comment_likes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);