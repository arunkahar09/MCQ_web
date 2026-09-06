const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { query, testConnection, getActiveEngine } = require('../config/database');

async function initDatabase() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'mcq_test_db';

  console.log(`\n========================================`);
  console.log(`🔄 Checking Database Connection...`);
  console.log(`========================================\n`);

  let isMysql = false;

  try {
    const rootConnection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConnection.end();
    isMysql = true;
    console.log(`✅ MySQL database '${database}' ready.`);
  } catch (err) {
    console.warn(`ℹ️ MySQL connection note (${err.message}). Using local SQLite database.`);
  }

  // Create Tables using our universal query helper
  console.log(`📋 Creating tables...`);

  if (isMysql) {
    const dbConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true
    });

    const schema = `
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('student', 'admin') DEFAULT 'student',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS \`subjects\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL,
        \`code\` VARCHAR(50) NOT NULL UNIQUE,
        \`description\` TEXT,
        \`icon\` VARCHAR(50) DEFAULT 'book-open',
        \`color\` VARCHAR(20) DEFAULT '#4f46e5',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS \`tests\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`subject_id\` INT NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`description\` TEXT,
        \`duration_minutes\` INT NOT NULL DEFAULT 10,
        \`total_marks\` INT NOT NULL DEFAULT 10,
        \`passing_percentage\` DECIMAL(5,2) DEFAULT 40.00,
        \`is_published\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS \`questions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`test_id\` INT NOT NULL,
        \`question_text\` TEXT NOT NULL,
        \`option_a\` TEXT NOT NULL,
        \`option_b\` TEXT NOT NULL,
        \`option_c\` TEXT NOT NULL,
        \`option_d\` TEXT NOT NULL,
        \`correct_option\` ENUM('A', 'B', 'C', 'D') NOT NULL,
        \`marks\` INT NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`test_id\`) REFERENCES \`tests\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS \`test_attempts\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`test_id\` INT NOT NULL,
        \`total_questions\` INT NOT NULL DEFAULT 0,
        \`correct_answers\` INT NOT NULL DEFAULT 0,
        \`wrong_answers\` INT NOT NULL DEFAULT 0,
        \`unanswered_questions\` INT NOT NULL DEFAULT 0,
        \`score\` DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        \`total_marks\` DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        \`percentage\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        \`status\` ENUM('passed', 'failed') NOT NULL DEFAULT 'failed',
        \`started_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`submitted_at\` TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`test_id\`) REFERENCES \`tests\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS \`student_answers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`attempt_id\` INT NOT NULL,
        \`question_id\` INT NOT NULL,
        \`selected_option\` ENUM('A', 'B', 'C', 'D') NULL,
        \`is_correct\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`attempt_id\`) REFERENCES \`test_attempts\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`question_id\`) REFERENCES \`questions\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await dbConn.query(schema);
    await dbConn.end();
  } else {
    // SQLite Tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'student',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT DEFAULT 'book-open',
        color TEXT DEFAULT '#4f46e5',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 10,
        total_marks INTEGER NOT NULL DEFAULT 10,
        passing_percentage REAL DEFAULT 40.00,
        is_published INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL,
        marks INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS test_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        test_id INTEGER NOT NULL,
        total_questions INTEGER NOT NULL DEFAULT 0,
        correct_answers INTEGER NOT NULL DEFAULT 0,
        wrong_answers INTEGER NOT NULL DEFAULT 0,
        unanswered_questions INTEGER NOT NULL DEFAULT 0,
        score REAL NOT NULL DEFAULT 0.00,
        total_marks REAL NOT NULL DEFAULT 0.00,
        percentage REAL NOT NULL DEFAULT 0.00,
        status TEXT NOT NULL DEFAULT 'failed',
        started_at TEXT DEFAULT (datetime('now')),
        submitted_at TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS student_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        selected_option TEXT NULL,
        is_correct INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      );
    `);
  }

  console.log(`✅ Tables created/verified.`);

  // 3. Seed Default Users
  console.log(`🌱 Seeding default users (Admin & Demo Student)...`);
  const adminPassword = await bcrypt.hash('admin123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  const [existingAdmin] = await query('SELECT id FROM users WHERE email = ?', ['admin@mcq.com']);
  if (existingAdmin.length === 0) {
    await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['System Administrator', 'admin@mcq.com', adminPassword, 'admin']
    );
  }

  const [existingStudent] = await query('SELECT id FROM users WHERE email = ?', ['student@mcq.com']);
  if (existingStudent.length === 0) {
    await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Demo Student', 'student@mcq.com', studentPassword, 'student']
    );
  }

  // 4. Seed Subjects
  console.log(`🌱 Seeding subjects...`);
  const subjects = [
    { name: 'Web Development', code: 'WEB_DEV', description: 'HTML, CSS, modern JavaScript, frontend frameworks, and RESTful APIs.', icon: 'globe', color: '#0ea5e9' },
    { name: 'Computer Science & IT', code: 'CS_IT', description: 'Core computer science, algorithms, operating systems, and networking.', icon: 'laptop-code', color: '#6366f1' },
    { name: 'Python Programming', code: 'PYTHON_PROG', description: 'Python data structures, object-oriented concepts, and standard libraries.', icon: 'terminal', color: '#10b981' },
    { name: 'General Aptitude & Reasoning', code: 'APTITUDE', description: 'Quantitative mathematics, logical deduction, and problem solving.', icon: 'brain', color: '#f59e0b' },
    { name: 'General Science & Tech', code: 'SCIENCE_TECH', description: 'Physics, chemistry, biology, and contemporary science discoveries.', icon: 'flask', color: '#ec4899' }
  ];

  for (const s of subjects) {
    const [existingSub] = await query('SELECT id FROM subjects WHERE code = ?', [s.code]);
    if (existingSub.length === 0) {
      await query(
        'INSERT INTO subjects (name, code, description, icon, color) VALUES (?, ?, ?, ?, ?)',
        [s.name, s.code, s.description, s.icon, s.color]
      );
    }
  }

  // Map subjects
  const [allSubs] = await query('SELECT id, code FROM subjects');
  const subMap = {};
  allSubs.forEach(r => { subMap[r.code] = r.id; });

  // 5. Seed Tests and 4-Option Questions
  console.log(`🌱 Seeding sample tests and 4-option MCQs...`);
  const testsData = [
    {
      subject_id: subMap['WEB_DEV'],
      title: 'JavaScript Fundamentals & ES6+ Mastery',
      description: 'Test your understanding of JavaScript core concepts, scopes, closures, promises, and modern ES6 features.',
      duration_minutes: 5,
      total_marks: 5,
      passing_percentage: 60.00,
      questions: [
        {
          question_text: 'Which of the following methods is used to convert a JSON string into a JavaScript object?',
          option_a: 'JSON.stringify()',
          option_b: 'JSON.parse()',
          option_c: 'JSON.toObject()',
          option_d: 'JSON.convert()',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'What will be the output of `typeof NaN` in JavaScript?',
          option_a: 'undefined',
          option_b: 'NaN',
          option_c: 'number',
          option_d: 'object',
          correct_option: 'C',
          marks: 1
        },
        {
          question_text: 'Which keyword creates a block-scoped variable that cannot be reassigned in JavaScript?',
          option_a: 'var',
          option_b: 'let',
          option_c: 'const',
          option_d: 'static',
          correct_option: 'C',
          marks: 1
        },
        {
          question_text: 'What does the `===` operator check in JavaScript?',
          option_a: 'Only value equality',
          option_b: 'Both value and type equality',
          option_c: 'Reference memory address only',
          option_d: 'String conversion equality',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'Which array method returns a brand new array populated with the results of calling a provided function on every element?',
          option_a: 'Array.prototype.forEach()',
          option_b: 'Array.prototype.filter()',
          option_c: 'Array.prototype.map()',
          option_d: 'Array.prototype.reduce()',
          correct_option: 'C',
          marks: 1
        }
      ]
    },
    {
      subject_id: subMap['CS_IT'],
      title: 'Data Structures & Algorithms Basics',
      description: 'Evaluate your knowledge on Arrays, Stacks, Queues, Linked Lists, and Big-O Complexity.',
      duration_minutes: 5,
      total_marks: 5,
      passing_percentage: 50.00,
      questions: [
        {
          question_text: 'What is the worst-case time complexity of searching an element in a balanced Binary Search Tree (BST)?',
          option_a: 'O(1)',
          option_b: 'O(log N)',
          option_c: 'O(N)',
          option_d: 'O(N log N)',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'Which data structure follows the Last In First Out (LIFO) order?',
          option_a: 'Queue',
          option_b: 'Stack',
          option_c: 'Heap',
          option_d: 'Binary Tree',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'Which data structure is primarily used for implementing Breadth-First Search (BFS) on a graph?',
          option_a: 'Stack',
          option_b: 'Queue',
          option_c: 'Priority Queue',
          option_d: 'HashMap',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'In a singly linked list, what is the time complexity to insert a node at the beginning (head)?',
          option_a: 'O(1)',
          option_b: 'O(N)',
          option_c: 'O(log N)',
          option_d: 'O(N^2)',
          correct_option: 'A',
          marks: 1
        },
        {
          question_text: 'Which sorting algorithm has the best average-case time complexity of O(N log N) and is typically implemented with divide-and-conquer?',
          option_a: 'Bubble Sort',
          option_b: 'Selection Sort',
          option_c: 'Merge Sort',
          option_d: 'Insertion Sort',
          correct_option: 'C',
          marks: 1
        }
      ]
    },
    {
      subject_id: subMap['PYTHON_PROG'],
      title: 'Python Core Concepts & Syntax',
      description: 'A comprehensive quiz testing Python lists, tuples, dictionaries, functions, and standard operations.',
      duration_minutes: 5,
      total_marks: 5,
      passing_percentage: 50.00,
      questions: [
        {
          question_text: 'Which of the following collections in Python is immutable?',
          option_a: 'List',
          option_b: 'Set',
          option_c: 'Tuple',
          option_d: 'Dictionary',
          correct_option: 'C',
          marks: 1
        },
        {
          question_text: 'What will `len("Python"[1:4])` return in Python?',
          option_a: '2',
          option_b: '3',
          option_c: '4',
          option_d: '5',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'Which built-in function is used to get the memory address or unique identifier of an object in Python?',
          option_a: 'ref()',
          option_b: 'id()',
          option_c: 'loc()',
          option_d: 'type()',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'How do you define a function in Python?',
          option_a: 'function myFunc():',
          option_b: 'def myFunc():',
          option_c: 'func myFunc():',
          option_d: 'define myFunc():',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'What is the output of `bool([])` in Python?',
          option_a: 'True',
          option_b: 'False',
          option_c: 'None',
          option_d: 'TypeError',
          correct_option: 'B',
          marks: 1
        }
      ]
    },
    {
      subject_id: subMap['APTITUDE'],
      title: 'Quantitative Aptitude & Logical Reasoning',
      description: 'Sharpen your aptitude skills with percentages, ratios, time-speed-distance, and logical reasoning.',
      duration_minutes: 5,
      total_marks: 5,
      passing_percentage: 40.00,
      questions: [
        {
          question_text: 'If a shirt originally costing $50 is discounted by 20%, what is its sale price?',
          option_a: '$35',
          option_b: '$40',
          option_c: '$42',
          option_d: '$45',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'What is the next number in the series: 2, 6, 12, 20, 30, ...?',
          option_a: '40',
          option_b: '42',
          option_c: '44',
          option_d: '48',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'A car travels at 60 km/h. How many meters does it travel in one second?',
          option_a: '16.67 m',
          option_b: '20.00 m',
          option_c: '25.50 m',
          option_d: '15.00 m',
          correct_option: 'A',
          marks: 1
        },
        {
          question_text: 'If 5 workers can complete a task in 12 days, how many days will 10 workers take to complete the same task?',
          option_a: '3 days',
          option_b: '6 days',
          option_c: '8 days',
          option_d: '24 days',
          correct_option: 'B',
          marks: 1
        },
        {
          question_text: 'What is 15% of 240?',
          option_a: '32',
          option_b: '36',
          option_c: '38',
          option_d: '40',
          correct_option: 'B',
          marks: 1
        }
      ]
    }
  ];

  for (const t of testsData) {
    if (!t.subject_id) continue;
    const [existing] = await query('SELECT id FROM tests WHERE title = ? AND subject_id = ?', [t.title, t.subject_id]);
    let testId;

    if (existing.length > 0) {
      testId = existing[0].id;
    } else {
      const [ins] = await query(
        'INSERT INTO tests (subject_id, title, description, duration_minutes, total_marks, passing_percentage, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [t.subject_id, t.title, t.description, t.duration_minutes, t.total_marks, t.passing_percentage, 1]
      );
      testId = ins.insertId;
    }

    const [qCount] = await query('SELECT COUNT(*) as count FROM questions WHERE test_id = ?', [testId]);
    const countVal = qCount[0] ? (qCount[0].count || 0) : 0;

    if (countVal === 0) {
      for (const q of t.questions) {
        await query(
          'INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [testId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks]
        );
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 Database setup & seeding complete!`);
  console.log(`🔑 Admin Login:   admin@mcq.com   / admin123`);
  console.log(`🎓 Student Login: student@mcq.com / student123`);
  console.log(`========================================\n`);

  return true;
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = initDatabase;
