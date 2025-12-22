import { defineConfig } from 'vite';

// https://vitejs.dev/config/
// CHANGED: Usunięto React plugin - używamy vanilla JS
export default defineConfig({
  plugins: [],
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
  },
});
