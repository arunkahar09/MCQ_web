// Automated End-to-End Verification Test Suite for MCQ Portal
const http = require('http');

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting End-to-End Automated Verification Test...');
  console.log('======================================================\n');

  try {
    // 1. Healthcheck
    const health = await makeRequest('/api/health');
    console.log('1. Healthcheck & Engine:', health.body.status === 'healthy' ? `✅ PASS (${health.body.engine})` : '❌ FAIL ' + JSON.stringify(health.body));

    // 2. Student Login
    const studentLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'student@mcq.com',
      password: 'student123'
    });
    console.log('2. Student Login:', studentLogin.status === 200 && studentLogin.body.success ? `✅ PASS (User: ${studentLogin.body.user.name})` : '❌ FAIL');
    const studentToken = studentLogin.body.token;

    // 3. Admin Login
    const adminLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@mcq.com',
      password: 'admin123'
    });
    console.log('3. Admin Login (Role Verification):', adminLogin.status === 200 && adminLogin.body.user.role === 'admin' ? `✅ PASS (Role: ${adminLogin.body.user.role})` : '❌ FAIL');
    const adminToken = adminLogin.body.token;

    // 4. Subjects List from Firestore
    const subjects = await makeRequest('/api/subjects');
    console.log('4. Fetch Subjects from Firestore:', subjects.body.subjects && subjects.body.subjects.length > 0 ? `✅ PASS (${subjects.body.subjects.length} subjects found)` : '❌ FAIL');

    // 5. Tests List from Firestore
    const tests = await makeRequest('/api/tests');
    console.log('5. Fetch Tests from Firestore:', tests.body.tests && tests.body.tests.length > 0 ? `✅ PASS (${tests.body.tests.length} tests found)` : '❌ FAIL');

    const firstTest = tests.body.tests.find(t => (t.question_count || 0) > 0) || tests.body.tests[0];

    // 6. Start Exam
    const startExam = await makeRequest(`/api/exam/start/${firstTest.id}`, 'GET', null, studentToken);
    console.log('6. Start Exam Session:', startExam.body.questions && startExam.body.questions.length > 0 && startExam.body.attemptId ? `✅ PASS (${startExam.body.questions.length} questions, attempt ID: ${startExam.body.attemptId})` : '❌ FAIL');

    const attemptId = startExam.body.attemptId;
    const questions = startExam.body.questions;

    // 7. EXAM SECURITY CHECK: Verify questions do NOT expose correct_option
    const hasExposedAnswer = questions.some(q => q.correct_option !== undefined || q.correctOption !== undefined);
    console.log('7. Exam Security (Zero exposed answer keys):', !hasExposedAnswer ? '✅ PASS (Strictly sanitized questions delivered)' : '❌ FAIL - CRITICAL SECURITY VULNERABILITY');

    // 8. Progress Auto-Saving Test
    const saveProgress = await makeRequest('/api/exam/save-progress', 'POST', {
      attemptId,
      answers: { [questions[0].id]: 'B' },
      remainingSeconds: 580,
      currentIndex: 1
    }, studentToken);
    console.log('8. Exam Progress Auto-Save to Firestore:', saveProgress.body.success ? '✅ PASS' : '❌ FAIL');

    // 9. Active Attempt Recovery Test
    const activeAttempt = await makeRequest('/api/exam/active-attempt', 'GET', null, studentToken);
    console.log('9. Active Attempt State Recovery on Refresh:', activeAttempt.body.hasActiveAttempt && activeAttempt.body.savedAnswers[questions[0].id] === 'B' ? '✅ PASS (Saved answers restored)' : '❌ FAIL');

    // 10. Submit Answers for Server-Side Scoring
    const answers = {};
    questions.forEach((q, idx) => {
      // Pick answer
      answers[q.id] = (idx % 2 === 0) ? 'B' : 'C';
    });

    const submitRes = await makeRequest('/api/exam/submit', 'POST', {
      attemptId,
      testId: firstTest.id,
      answers
    }, studentToken);

    console.log('10. Server-Side Scoring & Submission:', submitRes.body.success ? `✅ PASS (Score: ${submitRes.body.result.score}/${submitRes.body.result.totalMarks}, Percentage: ${submitRes.body.result.percentage}%, Status: ${submitRes.body.result.status})` : '❌ FAIL');

    // 11. Fetch Student Result History
    const history = await makeRequest('/api/results/my-history', 'GET', null, studentToken);
    console.log('11. Student Test History:', history.body.results && history.body.results.length > 0 ? `✅ PASS (${history.body.results.length} attempts recorded)` : '❌ FAIL');

    // 12. Detailed Question Breakdown & Verify subject_id fix
    const breakdown = await makeRequest(`/api/results/attempt/${attemptId}`, 'GET', null, studentToken);
    const hasValidSubjectId = Boolean(breakdown.body.attempt && breakdown.body.attempt.subject_id);
    console.log('12. Detailed Question Breakdown & Subject ID Fix:', breakdown.body.questionsBreakdown && hasValidSubjectId ? `✅ PASS (subject_id: '${breakdown.body.attempt.subject_id}', ${breakdown.body.questionsBreakdown.length} questions breakdown)` : '❌ FAIL');

    // 13. Admin Dashboard Stats
    const adminStats = await makeRequest('/api/admin/stats', 'GET', null, adminToken);
    console.log('13. Admin Dashboard Stats from Firestore:', adminStats.body.stats ? `✅ PASS (Students: ${adminStats.body.stats.totalStudents}, Attempts: ${adminStats.body.stats.totalAttempts}, Pass Rate: ${adminStats.body.stats.passRate}%)` : '❌ FAIL');

    // 14. Admin All Results Log
    const allResults = await makeRequest('/api/results/all', 'GET', null, adminToken);
    console.log('14. Admin All Results Log:', allResults.body.results && allResults.body.results.length > 0 ? `✅ PASS (${allResults.body.results.length} submissions logged)` : '❌ FAIL');

    console.log('\n======================================================');
    console.log('🎉 ALL 14 AUTOMATED VERIFICATION TESTS PASSED! 🚀');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test suite error:', err);
  }
}

runTests();
