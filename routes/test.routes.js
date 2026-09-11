const express = require('express');
const router = express.Router();
const { getDb } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

// GET /api/tests - Get all tests (with subject info and question count)
router.get('/', async (req, res) => {
  try {
    const { subject_id } = req.query;
    const db = getDb();

    let testsQuery = db.collection('tests');
    if (subject_id) {
      testsQuery = testsQuery.where('subject_id', '==', String(subject_id));
    }

    const testsSnap = await testsQuery.get();
    const subjectsSnap = await db.collection('subjects').get();
    const questionsSnap = await db.collection('questions').get();

    const subjectMap = {};
    subjectsSnap.docs.forEach(d => {
      subjectMap[d.id] = d.data();
    });

    const allQuestions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const tests = testsSnap.docs.map(doc => {
      const t = { id: doc.id, ...doc.data() };
      const sub = subjectMap[String(t.subject_id)] || {};
      const qCount = allQuestions.filter(q => String(q.test_id || q.testId) === String(doc.id)).length;

      return {
        ...t,
        subject_name: sub.name || 'General',
        subject_code: sub.code || 'GEN',
        subject_color: sub.color || '#4f46e5',
        subject_icon: sub.icon || 'book-open',
        question_count: qCount
      };
    });

    // Sort by created_at desc
    tests.sort((a, b) => (new Date(b.created_at || 0)) - (new Date(a.created_at || 0)));

    return res.json({ success: true, tests });
  } catch (err) {
    console.error('Fetch tests error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tests/:id - Get single test info and question count
router.get('/:id', async (req, res) => {
  try {
    const testId = String(req.params.id);
    const db = getDb();
    const testDoc = await db.collection('tests').doc(testId).get();

    if (!testDoc.exists) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    const test = { id: testDoc.id, ...testDoc.data() };
    const subDoc = await db.collection('subjects').doc(String(test.subject_id)).get();
    const sub = subDoc.exists ? subDoc.data() : {};

    const qSnap = await db.collection('questions').where('test_id', '==', testId).get();

    const testDetails = {
      ...test,
      subject_name: sub.name || 'General',
      subject_code: sub.code || 'GEN',
      subject_color: sub.color || '#4f46e5',
      subject_icon: sub.icon || 'book-open',
      question_count: qSnap.size || qSnap.docs.length
    };

    return res.json({
      success: true,
      test: testDetails
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/tests - Admin Create Test
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { subject_id, title, description, duration_minutes, total_marks, passing_percentage, is_published } = req.body;

    if (!subject_id || !title) {
      return res.status(400).json({ success: false, message: 'Subject and title are required.' });
    }

    const duration = parseInt(duration_minutes, 10) || 10;
    const marks = parseInt(total_marks, 10) || 10;
    const passPct = parseFloat(passing_percentage) || 40.0;
    const published = is_published === undefined ? true : Boolean(is_published);
    const now = new Date().toISOString();

    const db = getDb();
    const testData = {
      subject_id: String(subject_id),
      title: title.trim(),
      description: description ? description.trim() : '',
      duration_minutes: duration,
      total_marks: marks,
      passing_percentage: passPct,
      is_published: published,
      created_at: now,
      updated_at: now
    };

    const docRef = await db.collection('tests').add(testData);

    return res.status(201).json({
      success: true,
      message: 'Test created successfully!',
      testId: docRef.id
    });
  } catch (err) {
    console.error('Create test error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/tests/:id - Admin Update Test
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const testId = String(req.params.id);
    const { subject_id, title, description, duration_minutes, total_marks, passing_percentage, is_published } = req.body;

    if (!subject_id || !title) {
      return res.status(400).json({ success: false, message: 'Subject and title are required.' });
    }

    const duration = parseInt(duration_minutes, 10) || 10;
    const marks = parseInt(total_marks, 10) || 10;
    const passPct = parseFloat(passing_percentage) || 40.0;
    const published = is_published === undefined ? true : Boolean(is_published);
    const now = new Date().toISOString();

    const db = getDb();
    await db.collection('tests').doc(testId).update({
      subject_id: String(subject_id),
      title: title.trim(),
      description: description ? description.trim() : '',
      duration_minutes: duration,
      total_marks: marks,
      passing_percentage: passPct,
      is_published: published,
      updated_at: now
    });

    return res.json({
      success: true,
      message: 'Test updated successfully!'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/tests/:id - Admin Delete Test
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const testId = String(req.params.id);
    const db = getDb();

    // Delete associated questions
    const qSnap = await db.collection('questions').where('test_id', '==', testId).get();
    for (const qDoc of qSnap.docs) {
      await db.collection('questions').doc(qDoc.id).delete();
    }

    await db.collection('tests').doc(testId).delete();

    return res.json({
      success: true,
      message: 'Test deleted successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
