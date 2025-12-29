/*
  # Clean up duplicate conversation_participants table

  1. Changes
    - Drop the duplicate `conversation_participants` table
    - The code uses `conversation_members` table instead
    
  2. Note
    - This table was accidentally created and is not used by the application
    - All messenger functionality uses `conversation_members` table
*/

-- Drop the duplicate table if it exists
DROP TABLE IF EXISTS conversation_participants CASCADE;