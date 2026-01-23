/*
  # Add Calendar Section Editable Texts

  ## Changes
  
  1. New UI Text Elements
    - `calendar_title` - Main heading for calendar reservation section
    - `calendar_subtitle` - Subtitle/description text for calendar section
    - `calendar_embed_code` - HTML code for embedded calendar (can contain iframe or any HTML)
  
  ## Security
  
  - Uses existing `ui_texts` table with RLS policies already in place
  - Admin-only write access, public read access
*/

-- Insert calendar section editable texts
INSERT INTO ui_texts (element_id, content, updated_at)
VALUES 
  (
    'calendar_title',
    'System rezerwacji',
    now()
  ),
  (
    'calendar_subtitle',
    'Poniżej znajduje się kalendarz. Kliknij w wolny termin, aby zarezerwować.',
    now()
  ),
  (
    'calendar_embed_code',
    '<div class="iframe-placeholder big-placeholder"><p>Tutaj będzie osadzony kalendarz rezerwacji (iframe)</p></div>',
    now()
  )
ON CONFLICT (element_id) DO NOTHING;