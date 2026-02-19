/*
  # Security Fixes Part 3: Function Search Path Security

  ## Changes Made:
  
  ### Function Security
  - Set immutable `search_path = public` on all functions
  - Protects against search_path exploitation attacks
  - Ensures functions always reference correct schema
  - Uses CASCADE where needed to handle dependencies
  
  ## Security Improvements:
  - Protection against SQL injection via search_path manipulation
  - Predictable function behavior regardless of session settings
*/

-- Function: update_conversation_timestamp (with CASCADE)
DROP FUNCTION IF EXISTS update_conversation_timestamp() CASCADE;
CREATE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Recreate triggers that were dropped
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Function: handle_new_user (with CASCADE)
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger for handle_new_user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function: handle_updated_at (with CASCADE)
DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;
CREATE FUNCTION handle_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers that use handle_updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON blabla_posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON blabla_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ui_texts
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON training_modules
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Function: is_conversation_member
DROP FUNCTION IF EXISTS is_conversation_member(UUID, UUID) CASCADE;
CREATE FUNCTION is_conversation_member(conversation_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM conversation_members 
    WHERE conversation_id = conversation_uuid 
    AND user_id = user_uuid
  );
END;
$$;

-- Function: debug_conversation_access
DROP FUNCTION IF EXISTS debug_conversation_access(UUID) CASCADE;
CREATE FUNCTION debug_conversation_access(conv_id UUID)
RETURNS TABLE (
  user_id UUID,
  is_member BOOLEAN,
  is_creator BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as user_id,
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = conv_id 
      AND conversation_members.user_id = auth.uid()
    ) as is_member,
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conv_id 
      AND created_by = auth.uid()
    ) as is_creator;
END;
$$;

-- Function: debug_current_user
DROP FUNCTION IF EXISTS debug_current_user() CASCADE;
CREATE FUNCTION debug_current_user()
RETURNS TABLE (
  current_uid UUID,
  user_role TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_uid,
    auth.role() as user_role;
END;
$$;