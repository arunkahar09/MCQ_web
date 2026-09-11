const express = require('express');
const router = express.Router();
const { getDb } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/stats - Admin Dashboard Statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const db = getDb();

    const usersSnap = await db.collection('users').where('role', '==', 'student').get();
    const subjectsSnap = await db.collection('subjects').get();
    const testsSnap = await db.collection('tests').get();
    const questionsSnap = await db.collection('questions').get();
    const attemptsSnap = await db.collection('test_attempts').get();

    const allAttempts = attemptsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.submitted_at && a.status !== 'in_progress');

    const totalStudents = usersSnap.size || usersSnap.docs.length;
    const totalSubjects = subjectsSnap.size || subjectsSnap.docs.length;
    const totalTests = testsSnap.size || testsSnap.docs.length;
    const totalQuestions = questionsSnap.size || questionsSnap.docs.length;
    const totalAttempts = allAttempts.length;

    const passedAttempts = allAttempts.filter(a => a.status === 'passed').length;
    const passRate = totalAttempts > 0 ? Number(((passedAttempts / totalAttempts) * 100).toFixed(1)) : 0;

    const totalPercentageSum = allAttempts.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
    const avgScore = totalAttempts > 0 ? Number((totalPercentageSum / totalAttempts).toFixed(1)) : 0;

    // Sort recent attempts descending
    allAttempts.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    const recent = allAttempts.slice(0, 6).map(a => ({
      attempt_id: a.id,
      student_name: a.user_name || 'Student',
      test_title: a.test_title || 'MCQ Test',
      subject_name: a.subject_name || 'Subject',
      score: a.score || 0,
      total_marks: a.total_marks || 0,
      percentage: a.percentage || 0,
      status: a.status || 'failed',
      submitted_at: a.submitted_at
    }));

    return res.json({
      success: true,
      stats: {
        totalStudents,
        totalSubjects,
        totalTests,
        totalQuestions,
        totalAttempts,
        passRate,
        avgScore
      },
      recentAttempts: recent
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
