/**
 * Admin Creation and Promotion Utility for Supabase / Local Store
 * 
 * Usage:
 *   node scripts/create_admin.js [name] [email] [password]
 * Example:
 *   node scripts/create_admin.js "System Administrator" "admin@mcq.com" "admin123"
 */

const bcrypt = require('bcryptjs');
require('dotenv').config();

const { getDb, isLiveSupabase } = require('../config/supabase');

async function createAdmin() {
  const args = process.argv.slice(2);
  const name = args[0] || 'System Administrator';
  const email = (args[1] || 'admin@mcq.com').toLowerCase().trim();
  const password = args[2] || 'admin123';

  console.log('\n======================================================');
  console.log(`👑 Creating / Elevating Admin Account: ${email}`);
  console.log('======================================================\n');

  const db = getDb();
  const isLive = isLiveSupabase();
  console.log(`📡 Target Engine: ${isLive ? 'Supabase Cloud PostgreSQL' : 'Local Store'}`);

  try {
    const uid = 'usr_admin_' + Date.now();
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();

    if (!usersSnap.empty) {
      const docId = usersSnap.docs[0].id;
      await db.collection('users').doc(docId).update({
        role: 'admin',
        password_hash: hashedPassword,
        updated_at: now
      });
      console.log(`✅ Successfully updated user '${email}' to role: 'admin'`);
    } else {
      await db.collection('users').doc(uid).set({
        id: uid,
        name: name,
        email: email,
        password_hash: hashedPassword,
        role: 'admin',
        created_at: now,
        updated_at: now
      });
      console.log(`✅ Successfully created new Admin account '${email}'`);
    }

    console.log('\n======================================================');
    console.log('🎉 Admin Account is Ready!');
    console.log(`📧 Email:    ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🛡️ Role:     admin`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Error creating admin:', err);
  }
}

createAdmin();
