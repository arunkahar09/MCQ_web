/**
 * Compatibility Re-export Layer
 * Ensures seamless operation with Supabase backend.
 * Zero C++ native modules, zero sqlite3 GLIBC crash risks on Vercel.
 */

const { db, getDb, isLiveSupabase, getSupabaseClient, initSupabase } = require('./supabase');

module.exports = {
  db,
  getDb,
  getAuth: () => null,
  isLiveFirebase: isLiveSupabase,
  isLiveSupabase,
  getSupabaseClient,
  initFirebase: initSupabase,
  initSupabase
};
