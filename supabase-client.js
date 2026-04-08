/* =====================================================
   supabase-client.js — Supabase client singleton
   ===================================================== */

const SUPABASE_URL     = "https://bxmvyfcxslvttdwzvmxd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5YCRJXp0McvlNlACuf28Iw_hu1FCmjO";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
