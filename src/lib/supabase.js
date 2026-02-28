const { createClient } = require("@supabase/supabase-js");
// load .env already in entry point

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_URL.match(/^https?:\/\//i)) {
  console.error("🔴 Missing or invalid SUPABASE_URL environment variable.");
  console.error("   Add a valid URL (http:// or https://) to your .env file or environment.");
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.error("🔴 Missing SUPABASE_SERVICE_KEY environment variable.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

module.exports = supabase;
