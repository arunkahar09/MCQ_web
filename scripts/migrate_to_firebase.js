/**
 * Data Migration Utility for Supabase
 */

const { getDb, isLiveSupabase } = require('../config/supabase');
const initDatabase = require('../db/init');
require('dotenv').config();

async function migrate() {
  console.log('🚀 Running database sync with Supabase...');
  await initDatabase();
  console.log('✅ Database sync complete.');
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
  });
}

module.exports = migrate;
