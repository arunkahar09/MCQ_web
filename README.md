# QuizMaster — Production Online MCQ Testing Platform (Firebase Edition)

A cloud-based, multi-device, secure online MCQ testing portal designed with a human-crafted UI, robust role-based access control, Firebase Authentication, Cloud Firestore, and strict server-side exam evaluation.

---

## 🌟 Key Features

### 1. 🛡️ Absolute Exam Security (Zero Client-Side Answer Leakage)
- **Answer Key Protection**: Correct answers (`correct_option`) are **never** delivered to the student's browser during an active exam attempt.
- **Trusted Server-Side Scoring**: Student submissions send only `attemptId`, `testId`, and the selected choices. All scoring, percentages, and pass/fail statuses are computed server-side via Firebase Admin SDK.
- **Tamper-Proof Attempts**: Firestore security rules ensure students cannot read answer keys directly or modify finalized score records.

### 2. ⚡ Real-Time Timed Exam Engine & Attempt Recovery
- **Accurate Fixed Countdown Timers**: Real-time timer with visual urgency alerts (warning at ≤3 mins, danger at ≤1 min) and automatic submission upon expiration.
- **Continuous Auto-Saving & Recovery**: Active attempt progress is saved continuously to Firestore. If a student refreshes their page or loses connection, the attempt is restored automatically without losing remaining time or selected answers.
- **Keyboard Navigation**: Fast, accessible keyboard controls (<kbd>A</kbd>, <kbd>B</kbd>, <kbd>C</kbd>, <kbd>D</kbd> or <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>, <kbd>4</kbd> to select options, Arrow keys for Previous/Next).

### 3. 🎨 Human-Crafted, Professional UI (No AI Clichés)
- **Disciplined Design System**: Built with clean typography (`Outfit` headings + `Inter` body), a functional 8pt spacing grid, crisp 1px borders, and high-contrast color tokens.
- **Zero AI Template Tropes**: Free from excessive generic gradients, bloated floating cards, or fake statistics.
- **Multi-Device Responsive**: Clean, touch-friendly question cards on mobile, tablet, laptop, and desktop.

### 4. 📊 Comprehensive Results & Performance Review
- **Detailed Question-by-Question Breakdown**: Review selected answers alongside correct answers after test completion.
- **Fixed Navigation**: Accurate `subject_id` tracking across all attempt documents for smooth "Browse Tests" back navigation.
- **Direct Hash Routing**: Direct URL links (`#/result/:attemptId`, `#/subject/:subjectId`, `#/admin`) work reliably on page refresh.

### 5. 👑 Comprehensive Admin Portal
- **Dashboard Overview**: Live statistics (Students, Subjects, Tests, MCQs, Attempts, Pass Rate, and Recent Submissions).
- **Subject Management**: Create, edit, and delete subjects with custom icons and accent colors.
- **Test Management**: Configure duration, total marks, passing percentage, and publish toggles.
- **4-Option MCQ Question Editor**: Easily add and update 4-option questions with answer key selection.
- **All Submissions Log**: Audit and view detailed submissions from all students.

---

## 🏗️ Architecture & Firestore Schema

```
MCQ_TEST/
├── config/
│   ├── database.js          # Legacy database adapter (migration source)
│   └── firebase.js          # Firebase Admin SDK & Firestore connection
├── db/
│   ├── init.js              # Database initialization & seed data
│   └── schema.sql           # SQL schema reference
├── middleware/
│   └── auth.js              # Firebase ID token & role-based middleware
├── public/                  # Frontend single page application
│   ├── css/
│   │   └── main.css         # Human-crafted design system
│   ├── js/
│   │   ├── api.js           # HTTP & Bearer token client
│   │   ├── auth.js          # Authentication controller
│   │   ├── exam.js          # Timed exam runner & keyboard controls
│   │   ├── student.js       # Subjects & test browser
│   │   ├── result.js        # Score gauge & breakdown reviewer
│   │   ├── admin.js         # Admin management tabs & forms
│   │   └── app.js           # SPA hash router & theme manager
│   └── index.html           # Semantic HTML5 layout
├── routes/
│   ├── admin.routes.js      # Admin dashboard statistics
│   ├── auth.routes.js       # Signup, login, me, reset-password
│   ├── exam.routes.js       # Sanitized start, auto-save, server scoring
│   ├── question.routes.js   # Admin 4-option MCQ CRUD
│   ├── result.routes.js     # Student history & detailed breakdowns
│   ├── subject.routes.js    # Subject management
│   └── test.routes.js       # Test management & filtering
├── scripts/
│   ├── create_admin.js      # Admin creation CLI utility
│   └── migrate_to_firebase.js # Data migration from SQLite/MySQL to Firestore
├── test_suite.js            # 14-point automated test suite
├── firestore.rules          # Production Firestore security rules
├── firestore.indexes.json   # Composite index definitions
├── firebase.json            # Firebase CLI deployment config
├── server.js                # Express & Firebase server entry point
├── package.json
└── .env.example
```

### Firestore Collections Overview:
1. **`users/{uid}`**: `{ id, uid, name, email, role: 'student' | 'admin', created_at, updated_at }`
2. **`subjects/{subjectId}`**: `{ id, name, code, description, icon, color, created_at, updated_at }`
3. **`tests/{testId}`**: `{ id, subject_id, title, description, duration_minutes, total_marks, passing_percentage, is_published, created_at, updated_at }`
4. **`questions/{questionId}`**: `{ id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, created_at, updated_at }`
5. **`test_attempts/{attemptId}`**: `{ id, user_id, user_name, user_email, test_id, test_title, subject_id, subject_name, total_questions, correct_answers, wrong_answers, unanswered_questions, score, total_marks, percentage, passing_percentage, status: 'in_progress' | 'passed' | 'failed', answers: {}, started_at, submitted_at }`
6. **`student_answers/{answerId}`**: `{ attempt_id, question_id, user_id, selected_option, correct_option, is_correct, marks, created_at }`

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 2. Installation
```bash
# Clone or open the repository
cd MCQ_TEST

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Migrate Data to Firestore
Run the automated migration script to populate initial users, subjects, tests, and questions:
```bash
npm run migrate
```

### 5. Start the Application
```bash
npm start
```
Open your browser at: **`http://localhost:3000`**

### 6. Default Demo Credentials
| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@mcq.com` | `admin123` |
| **Student** | `student@mcq.com` | `student123` |

---

## 🔑 Creating Additional Admin Users

Use the included CLI utility to create new admins or elevate existing student accounts:
```bash
# Syntax: node scripts/create_admin.js "Full Name" "email@example.com" "password"
npm run create-admin "System Admin" "lead@mcq.com" "SecureAdmin2026!"
```

---

## ☁️ Connecting to Live Firebase Project

To connect this application to your Google Cloud / Firebase project:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Authentication** (Email/Password provider).
3. Enable **Cloud Firestore** in production mode.
4. Go to **Project Settings** > **Service accounts** > Click **Generate new private key** (`serviceAccountKey.json`).
5. Place `serviceAccountKey.json` in the root project folder, OR set the environment variables in `.env`:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
   ```
6. Deploy Firestore security rules and composite indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
7. Run the migration script to seed your cloud Firestore database:
   ```bash
   npm run migrate
   ```

---

## 🧪 Automated Testing

Run the 14-point automated test suite:
```bash
npm test
```

Verification includes:
- ✅ Database healthcheck & engine status
- ✅ Firebase Authentication & JWT verification
- ✅ Role-based authorization & admin access
- ✅ Firestore subjects & tests retrieval
- ✅ **Exam Security**: Verification that `correct_option` is stripped in exam start
- ✅ Progress auto-saving to Firestore
- ✅ Active attempt recovery upon page reload
- ✅ Server-side scoring & status evaluation
- ✅ Student test history recording
- ✅ Question-by-question breakdown & `subject_id` accuracy
- ✅ Admin dashboard statistics & submissions log

---

## 🌐 Production Deployment

### Option A: Firebase Hosting + Cloud Functions
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize & Deploy
firebase deploy
```

### Option B: Container / Cloud Run / Node.js Host
The application is fully production-ready for Docker, Google Cloud Run, Heroku, or Render:
```bash
npm start
```

---

## 📄 License
ISC License — built for educational testing and assessment portals.
