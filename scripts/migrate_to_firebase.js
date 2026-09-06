/**
 * Data Migration Script: MySQL / SQLite -> Cloud Firestore & Firebase Auth
 * 
 * Usage:
 *   node scripts/migrate_to_firebase.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { getDb, getAuth, isLiveFirebase } = require('../config/firebase');

function getSqliteRows(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function migrate() {
  console.log('\n======================================================');
  console.log('🚀 Starting MCQ Portal Migration to Cloud Firestore...');
  console.log('======================================================\n');

  const firestore = getDb();
  const auth = getAuth();
  const isLive = isLiveFirebase();

  console.log(`📡 Destination: ${isLive ? 'Live Firebase Project' : 'Local Firestore Storage Layer'}`);

  // 1. Connect to SQLite source database
  const sqlitePath = path.join(__dirname, '..', 'data', 'mcq_database.sqlite');
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ SQLite source database not found at: ${sqlitePath}`);
    process.exit(1);
  }

  const sqliteDb = new sqlite3.Database(sqlitePath);
  console.log(`📂 Connected to SQLite source: ${sqlitePath}`);

  try {
    // ==========================================
    // 1. MIGRATE USERS
    // ==========================================
    console.log('\n👤 1. Migrating Users...');
    const users = await getSqliteRows(sqliteDb, 'SELECT * FROM users');
    console.log(`Found ${users.length} users in source database.`);

    for (const u of users) {
      const email = u.email.toLowerCase().trim();
      const userRef = firestore.collection('users').doc(String(u.id));

      const existingDoc = await userRef.get();
      if (!existingDoc.exists) {
        let authUid = String(u.id);

        if (isLive && auth && typeof auth.createUser === 'function') {
          try {
            const existingAuth = await auth.getUserByEmail(email);
            authUid = existingAuth.uid;
          } catch (e) {
            // Create user in Firebase Auth
            try {
              const newAuth = await auth.createUser({
                email,
                displayName: u.name,
                password: 'TempPassword123!'
              });
              authUid = newAuth.uid;
            } catch (err) {
              console.warn(`Auth creation note for ${email}:`, err.message);
            }
          }
        }

        await userRef.set({
          id: String(u.id),
          uid: authUid,
          name: u.name,
          email: email,
          password_hash: u.password_hash,
          role: u.role || 'student',
          created_at: u.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        console.log(`   + Migrated User: [${u.role.toUpperCase()}] ${u.name} (${email})`);
      } else {
        console.log(`   * User already exists: ${email}`);
      }
    }

    // ==========================================
    // 2. MIGRATE SUBJECTS
    // ==========================================
    console.log('\n📚 2. Migrating Subjects...');
    const subjects = await getSqliteRows(sqliteDb, 'SELECT * FROM subjects');
    console.log(`Found ${subjects.length} subjects in source database.`);

    for (const s of subjects) {
      const subRef = firestore.collection('subjects').doc(String(s.id));
      const existing = await subRef.get();
      if (!existing.exists) {
        await subRef.set({
          id: String(s.id),
          name: s.name,
          code: s.code,
          description: s.description || '',
          icon: s.icon || 'book-open',
          color: s.color || '#4f46e5',
          created_at: s.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        console.log(`   + Migrated Subject: ${s.name} (${s.code})`);
      } else {
        console.log(`   * Subject already exists: ${s.name}`);
      }
    }

    // ==========================================
    // 3. MIGRATE TESTS
    // ==========================================
    console.log('\n📝 3. Migrating Tests...');
    const tests = await getSqliteRows(sqliteDb, 'SELECT * FROM tests');
    console.log(`Found ${tests.length} tests in source database.`);

    for (const t of tests) {
      const testRef = firestore.collection('tests').doc(String(t.id));
      const existing = await testRef.get();
      if (!existing.exists) {
        await testRef.set({
          id: String(t.id),
          subject_id: String(t.subject_id),
          title: t.title,
          description: t.description || '',
          duration_minutes: Number(t.duration_minutes) || 10,
          total_marks: Number(t.total_marks) || 10,
          passing_percentage: Number(t.passing_percentage) || 40.0,
          is_published: Boolean(t.is_published),
          created_at: t.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        console.log(`   + Migrated Test: ${t.title}`);
      } else {
        console.log(`   * Test already exists: ${t.title}`);
      }
    }

    // ==========================================
    // 4. MIGRATE QUESTIONS (4 Options + Answer Key)
    // ==========================================
    console.log('\n❓ 4. Migrating Questions...');
    const questions = await getSqliteRows(sqliteDb, 'SELECT * FROM questions');
    console.log(`Found ${questions.length} questions in source database.`);

    for (const q of questions) {
      const qRef = firestore.collection('questions').doc(String(q.id));
      const existing = await qRef.get();
      if (!existing.exists) {
        await qRef.set({
          id: String(q.id),
          test_id: String(q.test_id),
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option ? q.correct_option.toUpperCase().trim() : 'A',
          marks: Number(q.marks) || 1,
          created_at: q.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        console.log(`   + Migrated Question #${q.id} (Test #${q.test_id})`);
      } else {
        console.log(`   * Question #${q.id} already exists`);
      }
    }

    // ==========================================
    // 5. MIGRATE TEST ATTEMPTS & ANSWERS
    // ==========================================
    console.log('\n📊 5. Migrating Test Attempts & Student Answers...');
    const attempts = await getSqliteRows(sqliteDb, 'SELECT * FROM test_attempts');
    console.log(`Found ${attempts.length} test attempts in source database.`);

    for (const a of attempts) {
      const attemptRef = firestore.collection('test_attempts').doc(String(a.id));
      const existing = await attemptRef.get();

      // Fetch student answers for this attempt
      const studentAnswers = await getSqliteRows(sqliteDb, 'SELECT * FROM student_answers WHERE attempt_id = ?', [a.id]);
      const answersMap = {};
      studentAnswers.forEach(ans => {
        answersMap[String(ans.question_id)] = ans.selected_option;
      });

      // Find subject_id from test
      const [testRow] = await getSqliteRows(sqliteDb, 'SELECT subject_id, title FROM tests WHERE id = ?', [a.test_id]);
      const subjectId = testRow ? String(testRow.subject_id) : '1';
      const testTitle = testRow ? testRow.title : 'MCQ Test';

      if (!existing.exists) {
        await attemptRef.set({
          id: String(a.id),
          user_id: String(a.user_id),
          userId: String(a.user_id),
          test_id: String(a.test_id),
          testId: String(a.test_id),
          test_title: testTitle,
          subject_id: subjectId,
          total_questions: Number(a.total_questions) || 0,
          correct_answers: Number(a.correct_answers) || 0,
          wrong_answers: Number(a.wrong_answers) || 0,
          unanswered_questions: Number(a.unanswered_questions) || 0,
          score: Number(a.score) || 0,
          total_marks: Number(a.total_marks) || 0,
          percentage: Number(a.percentage) || 0,
          status: a.status || 'failed',
          started_at: a.started_at,
          submitted_at: a.submitted_at,
          answers: answersMap,
          is_completed: Boolean(a.submitted_at)
        });

        // Migrate student answer records
        for (const ans of studentAnswers) {
          const ansKey = `ans_${a.id}_${ans.question_id}`;
          await firestore.collection('student_answers').doc(ansKey).set({
            attempt_id: String(a.id),
            question_id: String(ans.question_id),
            user_id: String(a.user_id),
            selected_option: ans.selected_option,
            is_correct: Boolean(ans.is_correct),
            created_at: ans.created_at || a.submitted_at
          });
        }

        console.log(`   + Migrated Attempt #${a.id} (User #${a.user_id}, Score: ${a.score}/${a.total_marks})`);
      }
    }

    console.log('\n======================================================');
    console.log('✅ Migration to Firestore Completed Successfully! 🎉');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    sqliteDb.close();
  }
}

migrate();
