/**
 * Admin Creation and Promotion Utility
 * 
 * Usage:
 *   node scripts/create_admin.js [name] [email] [password]
 * Example:
 *   node scripts/create_admin.js "System Administrator" "admin@mcq.com" "admin123"
 */

const bcrypt = require('bcryptjs');
require('dotenv').config();

const { getDb, getAuth, isLiveFirebase } = require('../config/firebase');

async function createAdmin() {
  const args = process.argv.slice(2);
  const name = args[0] || 'System Administrator';
  const email = (args[1] || 'admin@mcq.com').toLowerCase().trim();
  const password = args[2] || 'admin123';

  console.log('\n======================================================');
  console.log(`👑 Creating / Elevating Admin Account: ${email}`);
  console.log('======================================================\n');

  const db = getDb();
  const auth = getAuth();
  const isLive = isLiveFirebase();

  try {
    let uid = 'usr_admin_' + Date.now();

    // Check Firebase Auth if live
    if (isLive && auth && typeof auth.createUser === 'function') {
      try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
        if (typeof auth.setCustomUserClaims === 'function') {
          await auth.setCustomUserClaims(uid, { role: 'admin' });
        }
        console.log(`✅ Set Firebase Auth custom claims (role=admin) for UID: ${uid}`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          const newAuth = await auth.createUser({
            email,
            password,
            displayName: name
          });
          uid = newAuth.uid;
          if (typeof auth.setCustomUserClaims === 'function') {
            await auth.setCustomUserClaims(uid, { role: 'admin' });
          }
          console.log(`✅ Created Firebase Auth Admin User (UID: ${uid})`);
        } else {
          console.warn('Firebase Auth note:', err.message);
        }
      }
    }

    // Check Firestore user doc
    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    if (!usersSnap.empty) {
      const docId = usersSnap.docs[0].id;
      await db.collection('users').doc(docId).update({
        role: 'admin',
        password_hash: hashedPassword,
        updated_at: now
      });
      console.log(`✅ Successfully updated Firestore user '${email}' to role: 'admin'`);
    } else {
      await db.collection('users').doc(uid).set({
        id: uid,
        uid: uid,
        name: name,
        email: email,
        password_hash: hashedPassword,
        role: 'admin',
        created_at: now,
        updated_at: now
      });
      console.log(`✅ Successfully created new Firestore Admin account '${email}'`);
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
