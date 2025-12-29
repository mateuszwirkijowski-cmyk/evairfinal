/*
  # Add Admin Edit Permissions for Posts and Comments

  ## Changes
  Updates the UPDATE policies for `blabla_posts` and `blabla_comments` to allow admins to edit any post or comment, in addition to users being able to edit their own content.

  ## Updated Policies

  ### `blabla_posts` - UPDATE policy:
  - Allow users to edit their own posts (auth.uid() = author_id)
  - OR allow admins to edit any post (role = 'admin' in profiles)

  ### `blabla_comments` - UPDATE policy:
  - Allow users to edit their own comments (auth.uid() = author_id)
  - OR allow admins to edit any comment (role = 'admin' in profiles)

  ## Notes
  - This enables content moderation by admins
  - Users retain full control over their own content
  - Admins can edit any content for moderation purposes
*/

-- ============================================
-- DROP OLD POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can update own posts" ON blabla_posts;
DROP POLICY IF EXISTS "Users can update own comments" ON blabla_comments;

-- ============================================
-- CREATE NEW POLICIES WITH ADMIN ACCESS
-- ============================================

-- Posts: Users can update own posts OR admins can update any post
CREATE POLICY "Users and admins can update posts"
    ON blabla_posts FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Comments: Users can update own comments OR admins can update any comment
CREATE POLICY "Users and admins can update comments"
    ON blabla_comments FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );