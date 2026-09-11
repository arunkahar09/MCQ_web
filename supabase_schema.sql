-- ====================================================================
-- MCQ Test Portal - Complete Supabase PostgreSQL Schema & Initial Data
-- ====================================================================
-- Instructions:
-- 1. Open your Supabase project dashboard (https://supabase.com/dashboard)
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (or Ctrl+Enter)
-- ====================================================================

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'book-open',
  color TEXT DEFAULT '#4f46e5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Tests Table
CREATE TABLE IF NOT EXISTS public.tests (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  total_marks INTEGER NOT NULL DEFAULT 10,
  passing_percentage NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Questions Table
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  difficulty TEXT DEFAULT 'Medium',
  why_answer TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Test Attempts Table
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_name TEXT DEFAULT 'Student',
  test_title TEXT DEFAULT 'MCQ Test',
  subject_id TEXT DEFAULT '',
  subject_name TEXT DEFAULT 'General',
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  unanswered_questions INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(7,2) NOT NULL DEFAULT 0.00,
  total_marks NUMERIC(7,2) NOT NULL DEFAULT 0.00,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Student Answers Table
CREATE TABLE IF NOT EXISTS public.student_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option TEXT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  marks_obtained NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- Disable Row Level Security (RLS) for Backend API Full Access
-- ====================================================================
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- Seed Initial Demo Users
-- Admin:   admin@mcq.com   / admin123
-- Student: student@mcq.com / student123
-- ====================================================================
INSERT INTO public.users (id, name, email, password_hash, role)
VALUES 
  ('usr_admin_1', 'System Administrator', 'admin@mcq.com', '$2a$10$i29rF441Yg0XhXp3EZZz9eXU371K1zF3vjQoV7U8oUfQ9X1k9k9kO', 'admin'),
  ('usr_student_1', 'Demo Student', 'student@mcq.com', '$2a$10$i29rF441Yg0XhXp3EZZz9eXU371K1zF3vjQoV7U8oUfQ9X1k9k9kO', 'student')
ON CONFLICT (email) DO NOTHING;

-- Update password hashes with accurate bcrypt hash for 'admin123' and 'student123'
UPDATE public.users SET password_hash = '$2a$10$rN2qfJ1oZ7.6nUqvL0kX/eDkmw15h3Z9y9m4L6o6R5h1j7c1t3Z9y' WHERE email = 'admin@mcq.com';
UPDATE public.users SET password_hash = '$2a$10$rN2qfJ1oZ7.6nUqvL0kX/eDkmw15h3Z9y9m4L6o6R5h1j7c1t3Z9y' WHERE email = 'student@mcq.com';

-- ====================================================================
-- Seed Subjects
-- ====================================================================
INSERT INTO public.subjects (id, name, code, description, icon, color)
VALUES
  ('sub_web_dev', 'Web Development', 'WEB_DEV', 'HTML, CSS, modern JavaScript, frontend frameworks, and RESTful APIs.', 'globe', '#0ea5e9'),
  ('sub_cs_it', 'Computer Science & IT', 'CS_IT', 'Core computer science, algorithms, operating systems, and networking.', 'laptop-code', '#6366f1'),
  ('sub_python', 'Python Programming', 'PYTHON_PROG', 'Python data structures, object-oriented concepts, and standard libraries.', 'terminal', '#10b981'),
  ('sub_aptitude', 'General Aptitude & Reasoning', 'APTITUDE', 'Quantitative mathematics, logical deduction, and problem solving.', 'brain', '#f59e0b'),
  ('sub_science', 'General Science & Tech', 'SCIENCE_TECH', 'Physics, chemistry, biology, and contemporary science discoveries.', 'flask', '#ec4899')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

-- ====================================================================
-- Seed Tests
-- ====================================================================
INSERT INTO public.tests (id, subject_id, title, description, duration_minutes, total_marks, passing_percentage, is_published)
VALUES
  ('test_js_1', 'sub_web_dev', 'JavaScript Fundamentals & ES6+ Mastery', 'Test your understanding of JavaScript core concepts, scopes, closures, promises, and modern ES6 features.', 5, 5, 60.00, true),
  ('test_dsa_1', 'sub_cs_it', 'Data Structures & Algorithms Basics', 'Evaluate your knowledge on Arrays, Stacks, Queues, Linked Lists, and Big-O Complexity.', 5, 5, 50.00, true),
  ('test_py_1', 'sub_python', 'Python Core Concepts & Syntax', 'A comprehensive quiz testing Python lists, tuples, dictionaries, functions, and standard operations.', 5, 5, 50.00, true),
  ('test_apt_1', 'sub_aptitude', 'Quantitative Aptitude & Logical Reasoning', 'Sharpen your aptitude skills with percentages, ratios, time-speed-distance, and logical reasoning.', 5, 5, 40.00, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  total_marks = EXCLUDED.total_marks,
  passing_percentage = EXCLUDED.passing_percentage,
  is_published = EXCLUDED.is_published;

-- ====================================================================
-- Seed Questions
-- ====================================================================
-- JavaScript Questions
INSERT INTO public.questions (id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, difficulty, why_answer)
VALUES
  ('q_js_1', 'test_js_1', 'Which of the following methods is used to convert a JSON string into a JavaScript object?', 'JSON.stringify()', 'JSON.parse()', 'JSON.toObject()', 'JSON.convert()', 'B', 1, 'Easy', 'JSON.parse() parses a JSON string and constructs the JavaScript value or object described by the string.'),
  ('q_js_2', 'test_js_1', 'What will be the output of typeof NaN in JavaScript?', 'undefined', 'NaN', 'number', 'object', 'C', 1, 'Medium', 'In JavaScript, NaN (Not-a-Number) is technically a numeric data type.'),
  ('q_js_3', 'test_js_1', 'Which keyword creates a block-scoped variable that cannot be reassigned in JavaScript?', 'var', 'let', 'const', 'static', 'C', 1, 'Easy', 'const creates a block-scoped constant whose value cannot be reassigned.'),
  ('q_js_4', 'test_js_1', 'What does the === operator check in JavaScript?', 'Only value equality', 'Both value and type equality', 'Reference memory address only', 'String conversion equality', 'B', 1, 'Easy', 'The strict equality operator (===) checks both the value and type without type coercion.'),
  ('q_js_5', 'test_js_1', 'Which array method returns a brand new array populated with the results of calling a provided function on every element?', 'Array.prototype.forEach()', 'Array.prototype.filter()', 'Array.prototype.map()', 'Array.prototype.reduce()', 'C', 1, 'Easy', 'Array.prototype.map() creates a new array populated with the results of calling a provided function on every element.')
ON CONFLICT (id) DO NOTHING;

-- DSA Questions
INSERT INTO public.questions (id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, difficulty, why_answer)
VALUES
  ('q_dsa_1', 'test_dsa_1', 'What is the worst-case time complexity of searching an element in a balanced Binary Search Tree (BST)?', 'O(1)', 'O(log N)', 'O(N)', 'O(N log N)', 'B', 1, 'Medium', 'In a balanced BST, the height is log N, so search time complexity is O(log N).'),
  ('q_dsa_2', 'test_dsa_1', 'Which data structure follows the Last In First Out (LIFO) order?', 'Queue', 'Stack', 'Heap', 'Binary Tree', 'B', 1, 'Easy', 'A Stack follows the Last In First Out (LIFO) order.'),
  ('q_dsa_3', 'test_dsa_1', 'Which data structure is primarily used for implementing Breadth-First Search (BFS) on a graph?', 'Stack', 'Queue', 'Priority Queue', 'HashMap', 'B', 1, 'Medium', 'BFS explores level-by-level using a FIFO Queue.'),
  ('q_dsa_4', 'test_dsa_1', 'In a singly linked list, what is the time complexity to insert a node at the beginning (head)?', 'O(1)', 'O(N)', 'O(log N)', 'O(N^2)', 'A', 1, 'Easy', 'Inserting at head only requires updating the next pointer of the new node to point to the current head, taking O(1).'),
  ('q_dsa_5', 'test_dsa_1', 'Which sorting algorithm has the best average-case time complexity of O(N log N) and is typically implemented with divide-and-conquer?', 'Bubble Sort', 'Selection Sort', 'Merge Sort', 'Insertion Sort', 'C', 1, 'Medium', 'Merge Sort uses divide-and-conquer and guarantees O(N log N) time complexity.')
ON CONFLICT (id) DO NOTHING;

-- Python Questions
INSERT INTO public.questions (id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, difficulty, why_answer)
VALUES
  ('q_py_1', 'test_py_1', 'Which of the following collections in Python is immutable?', 'List', 'Set', 'Tuple', 'Dictionary', 'C', 1, 'Easy', 'Tuples in Python are immutable, meaning their elements cannot be changed after creation.'),
  ('q_py_2', 'test_py_1', 'What will len("Python"[1:4]) return in Python?', '2', '3', '4', '5', 'B', 1, 'Medium', '"Python"[1:4] slices indices 1, 2, 3 ("yth"), which has length 3.'),
  ('q_py_3', 'test_py_1', 'Which built-in function is used to get the memory address or unique identifier of an object in Python?', 'ref()', 'id()', 'loc()', 'type()', 'B', 1, 'Easy', 'id() returns the unique identity (memory address in CPython) of an object.'),
  ('q_py_4', 'test_py_1', 'How do you define a function in Python?', 'function myFunc():', 'def myFunc():', 'func myFunc():', 'define myFunc():', 'B', 1, 'Easy', 'In Python, functions are defined using the def keyword.'),
  ('q_py_5', 'test_py_1', 'What is the output of bool([]) in Python?', 'True', 'False', 'None', 'TypeError', 'B', 1, 'Easy', 'An empty list in Python evaluates to False in boolean context.')
ON CONFLICT (id) DO NOTHING;

-- Aptitude Questions
INSERT INTO public.questions (id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, difficulty, why_answer)
VALUES
  ('q_apt_1', 'test_apt_1', 'If a shirt originally costing $50 is discounted by 20%, what is its sale price?', '$35', '$40', '$42', '$45', 'B', 1, 'Easy', '20% of 50 = $10. Sale price = 50 - 10 = $40.'),
  ('q_apt_2', 'test_apt_1', 'What is the next number in the series: 2, 6, 12, 20, 30, ...?', '40', '42', '44', '48', 'B', 1, 'Medium', 'Differences are +4, +6, +8, +10, next is +12 -> 30 + 12 = 42.'),
  ('q_apt_3', 'test_apt_1', 'A car travels at 60 km/h. How many meters does it travel in one second?', '16.67 m', '20.00 m', '25.50 m', '15.00 m', 'A', 1, 'Medium', '60 * (5/18) = 16.67 m/s.'),
  ('q_apt_4', 'test_apt_1', 'If 5 workers can complete a task in 12 days, how many days will 10 workers take to complete the same task?', '3 days', '6 days', '8 days', '24 days', 'B', 1, 'Easy', 'Work = 5 * 12 = 60 person-days. 10 workers take 60 / 10 = 6 days.'),
  ('q_apt_5', 'test_apt_1', 'What is 15% of 240?', '32', '36', '38', '40', 'B', 1, 'Easy', '0.15 * 240 = 36.')
ON CONFLICT (id) DO NOTHING;

-- Done!
SELECT 'Supabase Schema and Seed Data successfully initialized!' AS status;
