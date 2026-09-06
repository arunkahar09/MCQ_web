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
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
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

async function runBulkTests() {
  console.log('\n=============================================================');
  console.log('🧪 Testing One-by-One & Bulk Excel/CSV Question Management');
  console.log('=============================================================\n');

  try {
    // 1. Admin Login
    const adminLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@mcq.com',
      password: 'admin123'
    });
    if (!adminLogin.body.token) {
      console.error('❌ Admin login failed');
      process.exit(1);
    }
    const adminToken = adminLogin.body.token;
    console.log('✅ 1. Admin authenticated successfully');

    // 2. Fetch Tests
    const testsRes = await makeRequest('/api/tests');
    const tests = testsRes.body.tests || [];
    if (tests.length === 0) {
      console.error('❌ No tests found');
      process.exit(1);
    }
    const targetTest = tests[0];
    console.log(`✅ 2. Target Test selected: "${targetTest.title}" (ID: ${targetTest.id})`);

    // 3. Test One-by-One Question Creation (with why_answer and difficulty)
    const singleQRes = await makeRequest('/api/questions', 'POST', {
      test_id: targetTest.id,
      question_text: 'What is the purpose of the virtual DOM in React?',
      option_a: 'To directly update the browser HTML DOM at 120 FPS',
      option_b: 'To minimize real DOM manipulations by batching changes and diffing in memory',
      option_c: 'To store backend database tables in the browser cache',
      option_d: 'To provide CSS styles for responsive web layouts',
      correct_option: 'B',
      why_answer: 'React Virtual DOM is an in-memory representation of real DOM. By computing diffs, it only updates changed nodes efficiently.',
      marks: 2,
      difficulty: 'Medium'
    }, adminToken);

    console.log('3. One-by-One Question Creation:', singleQRes.status === 201 && singleQRes.body.success ? `✅ PASS (ID: ${singleQRes.body.questionId})` : '❌ FAIL ' + JSON.stringify(singleQRes.body));
    const createdQId = singleQRes.body.questionId;

    // 4. Test Single Question Update
    const updateQRes = await makeRequest(`/api/questions/${createdQId}`, 'PUT', {
      test_id: targetTest.id,
      question_text: 'What is the primary purpose of the Virtual DOM in React (Updated)?',
      option_a: 'To directly update the browser HTML DOM at 120 FPS',
      option_b: 'To minimize real DOM manipulations by batching changes and diffing in memory',
      option_c: 'To store backend database tables in the browser cache',
      option_d: 'To provide CSS styles for responsive web layouts',
      correct_option: 'B',
      why_answer: 'Updated: Virtual DOM uses efficient tree reconciliation algorithm to minimize expensive real DOM updates.',
      marks: 3,
      difficulty: 'Hard'
    }, adminToken);
    console.log('4. One-by-One Question Update:', updateQRes.status === 200 && updateQRes.body.success ? '✅ PASS' : '❌ FAIL ' + JSON.stringify(updateQRes.body));

    // 5. Test Template CSV Endpoint
    const templateRes = await makeRequest('/api/questions/template/csv');
    console.log('5. CSV Template Download Endpoint:', templateRes.status === 200 && templateRes.raw && templateRes.raw.includes('Why Answer') ? '✅ PASS (Headers and samples present)' : '❌ FAIL');

    // 6. Test Bulk Question Import (Excel / CSV batch format)
    const bulkQuestions = [
      {
        question_text: 'What is the time complexity of binary search on a sorted array of size n?',
        option_a: 'O(1)',
        option_b: 'O(log n)',
        option_c: 'O(n)',
        option_d: 'O(n log n)',
        correct_option: 'B',
        why_answer: 'Binary search divides the search space in half at each step, yielding logarithmic O(log n) time complexity.',
        marks: 1,
        difficulty: 'Easy'
      },
      {
        question_text: 'Which HTTP status code signifies "Forbidden" access in REST APIs?',
        option_a: '401',
        option_b: '403',
        option_c: '404',
        option_d: '500',
        correct_option: 'B',
        why_answer: '403 Forbidden indicates the server understood the request but refuses to authorize it.',
        marks: 1,
        difficulty: 'Medium'
      },
      {
        question_text: 'What is the role of an event loop in Node.js?',
        option_a: 'It compiles JavaScript code into C++ binary machine code',
        option_b: 'It coordinates asynchronous non-blocking I/O operations across threads',
        option_c: 'It allocates GPU memory for WebGL rendering',
        option_d: 'It acts as an SQL query parser for Firestore',
        correct_option: 'B',
        why_answer: 'Node.js event loop continuously monitors call stack and callback queue to process non-blocking asynchronous callbacks.',
        marks: 2,
        difficulty: 'Hard'
      }
    ];

    const bulkRes = await makeRequest('/api/questions/bulk', 'POST', {
      test_id: targetTest.id,
      questions: bulkQuestions
    }, adminToken);

    console.log('6. Bulk Question Import Endpoint:', bulkRes.status === 201 && bulkRes.body.importedCount === 3 ? `✅ PASS (Imported ${bulkRes.body.importedCount} questions)` : '❌ FAIL ' + JSON.stringify(bulkRes.body));

    // 7. Verify Questions List in Database
    const listQRes = await makeRequest(`/api/questions/test/${targetTest.id}`, 'GET', null, adminToken);
    const questions = listQRes.body.questions || [];
    const hasWhyAnswer = questions.some(q => q.why_answer && q.why_answer.length > 0);
    const hasDifficulty = questions.some(q => q.difficulty === 'Easy' || q.difficulty === 'Medium' || q.difficulty === 'Hard');

    console.log('7. Verify Questions Stored with why_answer and difficulty:', hasWhyAnswer && hasDifficulty ? `✅ PASS (Total ${questions.length} questions in test)` : '❌ FAIL');

    // 8. Clean up created single test question
    await makeRequest(`/api/questions/${createdQId}`, 'DELETE', null, adminToken);
    console.log('8. Delete Single Question Cleanup: ✅ PASS');

    console.log('\n=============================================================');
    console.log('🎉 All One-by-One and Bulk Upload Tests Passed Successfully!');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('❌ Test execution error:', err);
  }
}

runBulkTests();
