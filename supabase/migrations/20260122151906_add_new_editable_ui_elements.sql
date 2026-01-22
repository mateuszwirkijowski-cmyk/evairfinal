/*
  # Add New Editable UI Elements
  
  This migration adds default values for all new editable UI elements in the CMS system.
  
  1. New UI Text Elements
    - Category headers: 
      - `category_info` (Informacje)
      - `category_training` (Szkolenia)
      - `category_community` (Społeczność)
    
    - Navigation items:
      - `nav_welcome` (Witaj!)
      - `nav_announcements` (Ogłoszenia)
      - `nav_events` (Wydarzenia)
      - `nav_booking` (Kalendarz rezerwacji)
      - `nav_private_chat` (Evair - rozmowy)
    
    - Section titles and content:
      - `welcome_title` (Witaj na platformie Evair!)
      - `welcome_intro` (Cieszymy się, że jesteś z nami...)
      - `welcome_steps` (HTML list with 3 steps)
      - `events_title` (Nadchodzące wydarzenia)
      - `events_subtitle` (Zapisz się, aby wziąć udział.)
  
  2. Security
    - Elements are editable only by admins through the existing RLS policies on ui_texts table
*/

-- Insert default values for new editable UI elements
INSERT INTO ui_texts (element_id, content) VALUES
  -- Category headers
  ('category_info', 'Informacje'),
  ('category_training', 'Szkolenia'),
  ('category_community', 'Społeczność'),
  
  -- Navigation items
  ('nav_welcome', 'Witaj!'),
  ('nav_announcements', 'Ogłoszenia'),
  ('nav_events', 'Wydarzenia'),
  ('nav_booking', 'Kalendarz rezerwacji'),
  ('nav_private_chat', 'Evair - rozmowy'),
  
  -- Welcome section
  ('welcome_title', 'Witaj na platformie Evair!'),
  ('welcome_intro', 'Cieszymy się, że jesteś z nami. Oto kilka prostych kroków na początek:'),
  ('welcome_steps', '<li><strong>1.</strong> Uzupełnij swój profil (kliknij w swoje imię w prawym górnym rogu).</li><li><strong>2.</strong> Zapoznaj się z regulaminem (link w stopce strony).</li><li><strong>3.</strong> Rozpocznij rozmowy z innymi użytkownikami w sekcji „Evair - rozmowy".</li>'),
  
  -- Events section
  ('events_title', 'Nadchodzące wydarzenia'),
  ('events_subtitle', 'Zapisz się, aby wziąć udział.')
ON CONFLICT (element_id) DO NOTHING;