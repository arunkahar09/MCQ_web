/**
 * Database Initialization & Auto-Seeding Helper
 * Uses Supabase Cloud / Pure-JS Storage Layer.
 * Zero native binary modules (No sqlite3 / No node-gyp issues).
 */

const bcrypt = require('bcryptjs');
const { getDb, isLiveSupabase } = require('../config/supabase');
require('dotenv').config();

async function initDatabase() {
  const db = getDb();
  const isLive = isLiveSupabase();

  console.log(`🔄 Checking database state (${isLive ? 'Supabase Cloud' : 'Local Store'})...`);

  try {
    // 1. Verify/Seed Admin and Student
    const adminEmail = 'admin@mcq.com';
    const studentEmail = 'student@mcq.com';

    const adminSnap = await db.collection('users').where('email', '==', adminEmail).limit(1).get();
    if (adminSnap.empty) {
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const now = new Date().toISOString();
      await db.collection('users').doc('usr_admin_1').set({
        id: 'usr_admin_1',
        name: 'System Administrator',
        email: adminEmail,
        password_hash: adminPasswordHash,
        role: 'admin',
        created_at: now,
        updated_at: now
      });
      console.log('✅ Created default admin account: admin@mcq.com / admin123');
    }

    const studentSnap = await db.collection('users').where('email', '==', studentEmail).limit(1).get();
    if (studentSnap.empty) {
      const studentPasswordHash = await bcrypt.hash('student123', 10);
      const now = new Date().toISOString();
      await db.collection('users').doc('usr_student_1').set({
        id: 'usr_student_1',
        name: 'Demo Student',
        email: studentEmail,
        password_hash: studentPasswordHash,
        role: 'student',
        created_at: now,
        updated_at: now
      });
      console.log('✅ Created default student account: student@mcq.com / student123');
    }

    // 2. Verify/Seed Subjects
    const subjectsSnap = await db.collection('subjects').limit(1).get();
    if (subjectsSnap.empty) {
      console.log('🌱 Seeding initial subjects, tests, and MCQs...');

      const subjects = [
        {
          id: 'sub_web_dev',
          name: 'Web Development',
          code: 'WEB_DEV',
          description: 'HTML, CSS, modern JavaScript, frontend frameworks, and RESTful APIs.',
          icon: 'globe',
          color: '#0ea5e9'
        },
        {
          id: 'sub_cs_it',
          name: 'Computer Science & IT',
          code: 'CS_IT',
          description: 'Core computer science, algorithms, operating systems, and networking.',
          icon: 'laptop-code',
          color: '#6366f1'
        },
        {
          id: 'sub_python',
          name: 'Python Programming',
          code: 'PYTHON_PROG',
          description: 'Python data structures, object-oriented concepts, and standard libraries.',
          icon: 'terminal',
          color: '#10b981'
        },
        {
          id: 'sub_aptitude',
          name: 'General Aptitude & Reasoning',
          code: 'APTITUDE',
          description: 'Quantitative mathematics, logical deduction, and problem solving.',
          icon: 'brain',
          color: '#f59e0b'
        },
        {
          id: 'sub_science',
          name: 'General Science & Tech',
          code: 'SCIENCE_TECH',
          description: 'Physics, chemistry, biology, and contemporary science discoveries.',
          icon: 'flask',
          color: '#ec4899'
        }
      ];

      for (const s of subjects) {
        const now = new Date().toISOString();
        await db.collection('subjects').doc(s.id).set({
          ...s,
          created_at: now,
          updated_at: now
        });
      }

      // 3. Seed Sample Tests
      const tests = [
        {
          id: 'test_js_1',
          subject_id: 'sub_web_dev',
          title: 'JavaScript Fundamentals & ES6+ Mastery',
          description: 'Test your understanding of JavaScript core concepts, scopes, closures, promises, and modern ES6 features.',
          duration_minutes: 5,
          total_marks: 5,
          passing_percentage: 60.00,
          is_published: true
        },
        {
          id: 'test_dsa_1',
          subject_id: 'sub_cs_it',
          title: 'Data Structures & Algorithms Basics',
          description: 'Evaluate your knowledge on Arrays, Stacks, Queues, Linked Lists, and Big-O Complexity.',
          duration_minutes: 5,
          total_marks: 5,
          passing_percentage: 50.00,
          is_published: true
        },
        {
          id: 'test_py_1',
          subject_id: 'sub_python',
          title: 'Python Core Concepts & Syntax',
          description: 'A comprehensive quiz testing Python lists, tuples, dictionaries, functions, and standard operations.',
          duration_minutes: 5,
          total_marks: 5,
          passing_percentage: 50.00,
          is_published: true
        },
        {
          id: 'test_apt_1',
          subject_id: 'sub_aptitude',
          title: 'Quantitative Aptitude & Logical Reasoning',
          description: 'Sharpen your aptitude skills with percentages, ratios, time-speed-distance, and logical reasoning.',
          duration_minutes: 5,
          total_marks: 5,
          passing_percentage: 40.00,
          is_published: true
        }
      ];

      for (const t of tests) {
        const now = new Date().toISOString();
        await db.collection('tests').doc(t.id).set({
          ...t,
          created_at: now,
          updated_at: now
        });
      }

      // 4. Seed Questions
      const questions = [
        // JavaScript
        {
          id: 'q_js_1',
          test_id: 'test_js_1',
          question_text: 'Which of the following methods is used to convert a JSON string into a JavaScript object?',
          option_a: 'JSON.stringify()',
          option_b: 'JSON.parse()',
          option_c: 'JSON.toObject()',
          option_d: 'JSON.convert()',
          correct_option: 'B',
          marks: 1,
          difficulty: 'Easy',
          why_answer: 'JSON.parse() parses a JSON string and constructs the JavaScript value or object described by the string.'
        },
        {
          id: 'q_js_2',
          test_id: 'test_js_1',
          question_text: 'What will be the output of typeof NaN in JavaScript?',
          option_a: 'undefined',
          option_b: 'NaN',
          option_c: 'number',
          option_d: 'object',
          correct_option: 'C',
          marks: 1,
          difficulty: 'Medium',
          why_answer: 'In JavaScript, NaN (Not-a-Number) is technically of type number.'
        },
        {
          id: 'q_js_3',
          test_id: 'test_js_1',
          question_text: 'Which keyword creates a block-scoped variable that cannot be reassigned in JavaScript?',
          option_a: 'var',
          option_b: 'let',
          option_c: 'const',
          option_d: 'static',
          correct_option: 'C',
          marks: 1,
          difficulty: 'Easy',
          why_answer: 'const creates block-scoped variables that cannot be reassigned.'
        },
        {
          id: 'q_js_4',
          test_id: 'test_js_1',
          question_text: 'What does the === operator check in JavaScript?',
          option_a: 'Only value equality',
          option_b: 'Both value and type equality',
          option_c: 'Reference memory address only',
          option_d: 'String conversion equality',
          correct_option: 'B',
          marks: 1,
          difficulty: 'Easy',
          why_answer: 'Strict equality (===) checks both value and type without coercion.'
        },
        {
          id: 'q_js_5',
          test_id: 'test_js_1',
          question_text: 'Which array method returns a brand new array populated with the results of calling a provided function on every element?',
          option_a: 'Array.prototype.forEach()',
          option_b: 'Array.prototype.filter()',
          option_c: 'Array.prototype.map()',
          option_d: 'Array.prototype.reduce()',
          correct_option: 'C',
          marks: 1,
          difficulty: 'Easy',
          why_answer: 'map() returns a new array with elements transformed by the callback.'
        },
        // DSA
        {
          id: 'q_dsa_1',
          test_id: 'test_dsa_1',
          question_text: 'What is the worst-case time complexity of searching an element in a balanced Binary Search Tree (BST)?',
          option_a: 'O(1)',
          option_b: 'O(log N)',
          option_c: 'O(N)',
          option_d: 'O(N log N)',
          correct_option: 'B',
          marks: 1,
          difficulty: 'Medium',
          why_answer: 'In a balanced BST, tree height is log N, so search is O(log N).'
        },
        {
          id: 'q_dsa_2',
          test_id: 'test_dsa_1',
          question_text: 'Which data structure follows the Last In First Out (LIFO) order?',
          option_a: 'Queue',
          option_b: 'Stack',
          option_c: 'Heap',
          option_d: 'Binary Tree',
          correct_option: 'B',
          marks: 1,
          difficulty: 'Easy',
          why_answer: 'A Stack follows the Last In First Out (LIFO) order.'
        },
        // Python
        {
          id: 'q_py_1',
          test_id: 'test_py_1',
          question_text: 'Which of the following collections in Python is immutable?',
          option_a: 'List',
          option_b: 'Set',
          option_c: 'Tuple',
          option_d: 'Dictionary',
          correct_option: 'C',
          marks: 1,
          difficulty: 'Easy',
          why_answer: 'Tuples in Python are immutable.'
        },
        {
          id: 'q_py_2',
          test_id: 'test_py_1',
          question_text: 'What will len("Python"[1:4]) return in Python?',
          option_a: '2',
          option_b: '3',
          option_c: '4',
          option_d: '5',
          correct_option: 'B',
          marks: 1,
          difficulty: 'Medium',
          why_answer: '"Python"[1:4] is "yth" (length 3).'
        },
        // Aptitude
        {
          id: 'q_apt_1',
          test_id: 'test_apt_1',
          question_text: 'If a shirt originally costing $50 is discounted by 20%, what is its sale price?',
          option_a: '$35',
          option_b: '$40',
          option_c: '$42',
          option_d: '$45',
          correct_option: 'B',
          marks: 1,
          difficulty: 'Easy',
          why_answer: '20% of 50 = $10. Sale price = $40.'
        }
      ];

      for (const q of questions) {
        const now = new Date().toISOString();
        await db.collection('questions').doc(q.id).set({
          ...q,
          created_at: now
        });
      }

      console.log('✅ Initial database seeding complete!');
    }
  } catch (err) {
    console.warn('Database init warning:', err.message);
  }

  return true;
}

if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('🎉 Database initialization finished.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Database initialization error:', err);
      process.exit(1);
    });
}

module.exports = initDatabase;
