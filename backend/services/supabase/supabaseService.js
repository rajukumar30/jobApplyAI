const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

if (supabaseUrl && supabaseUrl !== 'https://your-project-ref.supabase.co' && supabaseServiceKey) {
  // Use the service_role key to bypass Row Level Security for backend operations
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('⚡ Supabase client initialized successfully');
} else {
  console.warn('⚠️ Supabase Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY missing/invalid in .env. Falling back to local storage.');
}

module.exports = { supabase };
