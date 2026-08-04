import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ipwmgkctxkopuszkuebh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6c9JTFFjI7_wxw64kZdHsA_4PCuX84A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
