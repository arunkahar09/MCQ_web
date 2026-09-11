/**
 * Supabase Cloud Seeding Script
 * 
 * Usage:
 *   node scripts/seed_supabase.js
 */

const { getDb, isLiveSupabase } = require('../config/supabase');
const initDatabase = require('../db/init');
require('dotenv').config();

async function runSeed() {
  console.log('\n======================================================');
  console.log('🚀 Running Supabase Database Initialization & Seeding...');
  console.log('======================================================\n');

  const isLive = isLiveSupabase();
  console.log(`📡 Destination: ${isLive ? 'Supabase Cloud PostgreSQL' : 'Local Pure-JS Storage Layer'}`);

  await initDatabase();
  console.log('\n======================================================');
  console.log('✅ Supabase Seeding Complete!');
  console.log('======================================================\n');
}

runSeed().then(() => process.exit(0)).catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
