const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');

// GET /api/exam/start/:testId - Student starts an exam attempt
router.get('/start/:testId', authenticate, async (req, res) => {
  try {
    const testId = String(req.params.testId);
    const userId = String(req.user.id || req.user.uid);
    const db = getDb();

    // Fetch test details
    const testDoc = await db.collection('tests').doc(testId).get();
    if (!testDoc.exists) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    const test = { id: testDoc.id, ...testDoc.data() };
    if (!test.is_published && test.is_published !== undefined && test.is_published !== 1) {
      return res.status(404).json({ success: false, message: 'Test is not currently published.' });
    }

    // Fetch subject details
    const subDoc = await db.collection('subjects').doc(String(test.subject_id)).get();
    const subject = subDoc.exists ? subDoc.data() : { name: 'General', code: 'GEN' };

    // Fetch questions from Firestore
    const questionsSnap = await db.collection('questions').where('test_id', '==', testId).get();
    if (questionsSnap.empty) {
      return res.status(400).json({
        success: false,
        message: 'This test does not have any questions yet. Please contact admin.'
      });
    }

    // EXAM SECURITY: Strip correct_option before sending to student frontend
    const sanitizedQuestions = questionsSnap.docs.map(doc => {
      const q = doc.data();
      return {
        id: doc.id,
        test_id: testId,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        marks: q.marks || 1
      };
    });

    // Sort questions deterministically
    sanitizedQuestions.sort((a, b) => a.id.localeCompare(b.id));

    const durationMinutes = test.duration_minutes || 10;
    const durationSeconds = durationMinutes * 60;
    const now = new Date().toISOString();

    // Create a new test attempt document in Firestore
    const attemptData = {
      user_id: userId,
      userId: userId,
      user_name: req.user.name || 'Student',
      user_email: req.user.email || '',
      test_id: testId,
      testId: testId,
      test_title: test.title,
      subject_id: String(test.subject_id),
      subject_name: subject.name,
      total_questions: sanitizedQuestions.length,
      total_marks: test.total_marks || sanitizedQuestions.length,
      passing_percentage: test.passing_percentage || 40.0,
      duration_minutes: durationMinutes,
      remaining_seconds: durationSeconds,
      started_at: now,
      status: 'in_progress',
      answers: {},
      current_index: 0
    };

    const attemptRef = await db.collection('test_attempts').add(attemptData);

    return res.json({
      success: true,
      attemptId: attemptRef.id,
      test: {
        id: test.id,
        title: test.title,
        subject_id: String(test.subject_id),
        subject_name: subject.name,
        duration_minutes: durationMinutes,
        duration_seconds: durationSeconds,
        total_marks: test.total_marks || sanitizedQuestions.length,
        passing_percentage: test.passing_percentage || 40.0
      },
      questions: sanitizedQuestions,
      remainingSeconds: durationSeconds,
      savedAnswers: {},
      currentIndex: 0,
      serverTime: now
    });
  } catch (err) {
    console.error('Exam start error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/exam/active-attempt - Retrieve active in-progress attempt for recovery on page reload
router.get('/active-attempt', authenticate, async (req, res) => {
  try {
    const userId = String(req.user.id || req.user.uid);
    const db = getDb();

    const attemptsSnap = await db.collection('test_attempts')
      .where('user_id', '==', userId)
      .where('status', '==', 'in_progress')
      .get();

    if (attemptsSnap.empty) {
      return res.json({ success: true, hasActiveAttempt: false });
    }

    // Find the latest in_progress attempt
    const activeDoc = attemptsSnap.docs[attemptsSnap.docs.length - 1];
    const attempt = { id: activeDoc.id, ...activeDoc.data() };

    // Fetch test & sanitized questions
    const testDoc = await db.collection('tests').doc(String(attempt.test_id)).get();
    if (!testDoc.exists) {
      return res.json({ success: true, hasActiveAttempt: false });
    }
    const test = { id: testDoc.id, ...testDoc.data() };

    const qSnap = await db.collection('questions').where('test_id', '==', String(attempt.test_id)).get();
    const sanitizedQuestions = qSnap.docs.map(doc => {
      const q = doc.data();
      return {
        id: doc.id,
        test_id: attempt.test_id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        marks: q.marks || 1
      };
    }).sort((a, b) => a.id.localeCompare(b.id));

    // Calculate elapsed time from started_at
    const startedAt = new Date(attempt.started_at).getTime();
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const totalAllowedSeconds = (attempt.duration_minutes || test.duration_minutes || 10) * 60;
    const remainingSeconds = Math.max(0, totalAllowedSeconds - elapsedSeconds);

    return res.json({
      success: true,
      hasActiveAttempt: true,
      attemptId: activeDoc.id,
      test: {
        id: test.id,
        title: test.title,
        subject_id: String(test.subject_id),
        subject_name: attempt.subject_name || 'Subject',
        duration_minutes: attempt.duration_minutes || test.duration_minutes || 10,
        total_marks: test.total_marks,
        passing_percentage: test.passing_percentage
      },
      questions: sanitizedQuestions,
      savedAnswers: attempt.answers || {},
      remainingSeconds,
      currentIndex: attempt.current_index || 0
    });
  } catch (err) {
    console.error('Active attempt check error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/exam/save-progress - Background auto-save answers & time during test
router.post('/save-progress', authenticate, async (req, res) => {
  try {
    const userId = String(req.user.id || req.user.uid);
    const { attemptId, answers, remainingSeconds, currentIndex } = req.body;

    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'Attempt ID is required.' });
    }

    const db = getDb();
    const attemptDoc = await db.collection('test_attempts').doc(String(attemptId)).get();

    if (!attemptDoc.exists) {
      return res.status(404).json({ success: false, message: 'Attempt not found.' });
    }

    const attempt = attemptDoc.data();
    if (attempt.user_id !== userId && attempt.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.json({ success: true, message: 'Attempt already submitted.' });
    }

    const updates = {};
    if (answers) updates.answers = answers;
    if (remainingSeconds !== undefined) updates.remaining_seconds = remainingSeconds;
    if (currentIndex !== undefined) updates.current_index = currentIndex;

    await db.collection('test_attempts').doc(String(attemptId)).update(updates);

    return res.json({ success: true, message: 'Progress saved.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/exam/submit - Secure Backend Scoring and Submission
router.post('/submit', authenticate, async (req, res) => {
  try {
    const userId = String(req.user.id || req.user.uid);
    const { attemptId, testId, answers } = req.body;

    if (!attemptId || !testId) {
      return res.status(400).json({
        success: false,
        message: 'Attempt ID and Test ID are required.'
      });
    }

    const db = getDb();

    // Verify attempt ownership
    const attemptDoc = await db.collection('test_attempts').doc(String(attemptId)).get();
    if (!attemptDoc.exists) {
      return res.status(404).json({ success: false, message: 'Test attempt not found.' });
    }

    const attempt = attemptDoc.data();
    if (attempt.user_id !== userId && attempt.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized attempt access.' });
    }

    // Fetch test details
    const testDoc = await db.collection('tests').doc(String(testId)).get();
    if (!testDoc.exists) {
      return res.status(404).json({ success: false, message: 'Test details not found.' });
    }
    const test = testDoc.data();

    // Fetch actual questions with correct answers from Firestore
    const questionsSnap = await db.collection('questions').where('test_id', '==', String(testId)).get();
    const dbQuestions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const studentAnswers = answers || attempt.answers || {};

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let totalScore = 0;
    let maxMarks = 0;

    const answerBreakdown = [];

    for (const q of dbQuestions) {
      const qMarks = Number(q.marks) || 1;
      maxMarks += qMarks;

      const selected = studentAnswers[q.id] ? String(studentAnswers[q.id]).toUpperCase().trim() : null;
      let isCorrect = false;

      if (!selected) {
        unansweredCount++;
      } else if (selected === q.correct_option) {
        correctCount++;
        totalScore += qMarks;
        isCorrect = true;
      } else {
        wrongCount++;
        isCorrect = false;
      }

      answerBreakdown.push({
        attempt_id: String(attemptId),
        question_id: String(q.id),
        user_id: userId,
        selected_option: selected,
        correct_option: q.correct_option,
        is_correct: isCorrect,
        marks: qMarks
      });
    }

    const totalQuestions = dbQuestions.length;
    const calculatedTotalMarks = maxMarks > 0 ? maxMarks : (test.total_marks || totalQuestions);
    const percentage = calculatedTotalMarks > 0 ? Number(((totalScore / calculatedTotalMarks) * 100).toFixed(2)) : 0;
    const passThreshold = parseFloat(test.passing_percentage) || 40.0;
    const status = percentage >= passThreshold ? 'passed' : 'failed';
    const submittedAt = new Date().toISOString();

    const subjectId = String(test.subject_id || attempt.subject_id || '1');

    // Update test_attempts document in Firestore
    const finalAttemptData = {
      total_questions: totalQuestions,
      correct_answers: correctCount,
      wrong_answers: wrongCount,
      unanswered_questions: unansweredCount,
      score: totalScore,
      total_marks: calculatedTotalMarks,
      percentage: percentage,
      passing_percentage: passThreshold,
      status: status,
      subject_id: subjectId,
      subjectId: subjectId,
      submitted_at: submittedAt,
      submittedAt: submittedAt,
      answers: studentAnswers,
      is_completed: true
    };

    await db.collection('test_attempts').doc(String(attemptId)).update(finalAttemptData);

    // Save individual student answers
    for (const ans of answerBreakdown) {
      const ansKey = `ans_${attemptId}_${ans.question_id}`;
      await db.collection('student_answers').doc(ansKey).set({
        ...ans,
        created_at: submittedAt
      });
    }

    return res.json({
      success: true,
      message: 'Test submitted and evaluated successfully!',
      attemptId: String(attemptId),
      result: {
        attemptId: String(attemptId),
        testId: String(testId),
        testTitle: test.title,
        subjectId: subjectId,
        totalQuestions,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        unansweredQuestions: unansweredCount,
        score: totalScore,
        totalMarks: calculatedTotalMarks,
        percentage: percentage,
        passingPercentage: passThreshold,
        status,
        submittedAt
      }
    });
  } catch (err) {
    console.error('Exam submission error:', err);
    return res.status(500).json({ success: false, message: 'Scoring error: ' + err.message });
  }
});

module.exports = router;
