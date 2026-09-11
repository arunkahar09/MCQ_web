const express = require('express');
const router = express.Router();
const { getDb } = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/results/my-history - Logged-in Student Test History
router.get('/my-history', authenticate, async (req, res) => {
  try {
    const userId = String(req.user.id || req.user.uid);
    const db = getDb();

    const attemptsSnap = await db.collection('test_attempts')
      .where('user_id', '==', userId)
      .get();

    const subjectsSnap = await db.collection('subjects').get();
    const subMap = {};
    subjectsSnap.docs.forEach(d => { subMap[d.id] = d.data(); });

    const results = attemptsSnap.docs
      .map(doc => {
        const a = { id: doc.id, ...doc.data() };
        const sub = subMap[String(a.subject_id)] || {};
        return {
          attempt_id: doc.id,
          test_id: a.test_id,
          test_title: a.test_title || 'Online MCQ Test',
          subject_id: a.subject_id,
          subject_name: a.subject_name || sub.name || 'General',
          subject_color: sub.color || '#4f46e5',
          subject_icon: sub.icon || 'book-open',
          total_questions: a.total_questions || 0,
          correct_answers: a.correct_answers || 0,
          wrong_answers: a.wrong_answers || 0,
          unanswered_questions: a.unanswered_questions || 0,
          score: a.score || 0,
          total_marks: a.total_marks || 0,
          percentage: a.percentage || 0,
          status: a.status || 'failed',
          started_at: a.started_at,
          submitted_at: a.submitted_at
        };
      })
      .filter(a => a.submitted_at && a.status !== 'in_progress');

    // Sort by submitted_at desc
    results.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    return res.json({
      success: true,
      results
    });
  } catch (err) {
    console.error('Fetch student history error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/results/attempt/:attemptId - Detailed result breakdown for an attempt
router.get('/attempt/:attemptId', authenticate, async (req, res) => {
  try {
    const attemptId = String(req.params.attemptId);
    const userId = String(req.user.id || req.user.uid);
    const isAdmin = req.user.role === 'admin';
    const db = getDb();

    // Fetch attempt details
    const attemptDoc = await db.collection('test_attempts').doc(attemptId).get();
    if (!attemptDoc.exists) {
      return res.status(404).json({ success: false, message: 'Result not found.' });
    }

    const attemptData = attemptDoc.data();
    if (!isAdmin && attemptData.user_id !== userId && attemptData.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Fetch Subject info
    const subDoc = await db.collection('subjects').doc(String(attemptData.subject_id)).get();
    const sub = subDoc.exists ? subDoc.data() : {};

    // Fetch Test info
    const testDoc = await db.collection('tests').doc(String(attemptData.test_id)).get();
    const test = testDoc.exists ? testDoc.data() : {};

    // Fetch Student user info
    const studentDoc = await db.collection('users').doc(String(attemptData.user_id)).get();
    const student = studentDoc.exists ? studentDoc.data() : {};

    // Standardized result attempt document with explicit subject_id
    const attempt = {
      id: attemptDoc.id,
      attempt_id: attemptDoc.id,
      user_id: attemptData.user_id,
      student_name: student.name || attemptData.user_name || 'Student',
      student_email: student.email || attemptData.user_email || '',
      test_id: attemptData.test_id,
      test_title: attemptData.test_title || test.title || 'MCQ Test',
      passing_percentage: attemptData.passing_percentage || test.passing_percentage || 40,
      subject_id: String(attemptData.subject_id || test.subject_id || '1'),
      subject_name: attemptData.subject_name || sub.name || 'Subject',
      subject_color: sub.color || '#4f46e5',
      total_questions: attemptData.total_questions,
      correct_answers: attemptData.correct_answers,
      wrong_answers: attemptData.wrong_answers,
      unanswered_questions: attemptData.unanswered_questions,
      score: attemptData.score,
      total_marks: attemptData.total_marks,
      percentage: attemptData.percentage,
      status: attemptData.status,
      started_at: attemptData.started_at,
      submitted_at: attemptData.submitted_at
    };

    // Fetch all questions for this test
    const qSnap = await db.collection('questions').where('test_id', '==', String(attemptData.test_id)).get();
    const questions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    questions.sort((a, b) => a.id.localeCompare(b.id));

    // Fetch student answers breakdown
    const savedAnswers = attemptData.answers || {};

    const questionsBreakdown = questions.map(q => {
      const selected = savedAnswers[q.id] ? String(savedAnswers[q.id]).toUpperCase().trim() : null;
      const isCorrect = selected === q.correct_option;

      return {
        question_id: q.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        why_answer: q.why_answer || '',
        difficulty: q.difficulty || 'Medium',
        marks: q.marks || 1,
        selected_option: selected,
        is_correct: isCorrect
      };
    });

    return res.json({
      success: true,
      attempt,
      questionsBreakdown
    });
  } catch (err) {
    console.error('Fetch attempt breakdown error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/results/all - Admin view all student test results
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const attemptsSnap = await db.collection('test_attempts').get();
    const usersSnap = await db.collection('users').get();
    const subjectsSnap = await db.collection('subjects').get();

    const userMap = {};
    usersSnap.docs.forEach(d => { userMap[d.id] = d.data(); });

    const subMap = {};
    subjectsSnap.docs.forEach(d => { subMap[d.id] = d.data(); });

    const results = attemptsSnap.docs
      .map(doc => {
        const a = { id: doc.id, ...doc.data() };
        const u = userMap[String(a.user_id)] || {};
        const s = subMap[String(a.subject_id)] || {};

        return {
          attempt_id: doc.id,
          user_id: a.user_id,
          student_name: u.name || a.user_name || 'Student',
          student_email: u.email || a.user_email || '',
          test_id: a.test_id,
          test_title: a.test_title || 'MCQ Test',
          subject_id: a.subject_id,
          subject_name: a.subject_name || s.name || 'Subject',
          total_questions: a.total_questions || 0,
          correct_answers: a.correct_answers || 0,
          wrong_answers: a.wrong_answers || 0,
          unanswered_questions: a.unanswered_questions || 0,
          score: a.score || 0,
          total_marks: a.total_marks || 0,
          percentage: a.percentage || 0,
          status: a.status || 'failed',
          submitted_at: a.submitted_at
        };
      })
      .filter(a => a.submitted_at && a.status !== 'in_progress');

    results.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    return res.json({
      success: true,
      results
    });
  } catch (err) {
    console.error('Fetch all results error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
