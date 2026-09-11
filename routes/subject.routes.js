const express = require('express');
const router = express.Router();
const { getDb } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

// GET /api/subjects - Get all subjects with test and question counts
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const subjectsSnap = await db.collection('subjects').orderBy('name', 'asc').get();
    const testsSnap = await db.collection('tests').get();
    const questionsSnap = await db.collection('questions').get();

    const allTests = testsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allQuestions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const subjects = subjectsSnap.docs.map(doc => {
      const sub = { id: doc.id, ...doc.data() };
      const subId = String(doc.id);

      // Count published tests
      const subTests = allTests.filter(t => String(t.subject_id || t.subjectId) === subId && (t.is_published === true || t.isPublished === true || t.is_published === 1));
      const subTestIds = new Set(subTests.map(t => String(t.id)));

      // Count questions across these tests
      const subQuestions = allQuestions.filter(q => subTestIds.has(String(q.test_id || q.testId)));

      return {
        ...sub,
        total_tests: subTests.length,
        total_questions: subQuestions.length
      };
    });

    return res.json({
      success: true,
      subjects
    });
  } catch (err) {
    console.error('Fetch subjects error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/subjects/:id - Get single subject with its tests
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const subId = String(req.params.id);
    const subDoc = await db.collection('subjects').doc(subId).get();

    if (!subDoc.exists) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const subject = { id: subDoc.id, ...subDoc.data() };

    const testsSnap = await db.collection('tests').where('subject_id', '==', subId).get();
    const questionsSnap = await db.collection('questions').get();
    const allQuestions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const tests = testsSnap.docs
      .map(doc => {
        const t = { id: doc.id, ...doc.data() };
        const qCount = allQuestions.filter(q => String(q.test_id || q.testId) === String(t.id)).length;
        return {
          ...t,
          question_count: qCount
        };
      })
      .filter(t => t.is_published === true || t.is_published === 1 || t.isPublished === true);

    return res.json({
      success: true,
      subject,
      tests
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/subjects - Admin Add Subject
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, code, description, icon, color } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Subject name and code are required.' });
    }

    const formattedCode = code.trim().toUpperCase();
    const db = getDb();

    // Check code uniqueness
    const existing = await db.collection('subjects').where('code', '==', formattedCode).limit(1).get();
    if (!existing.empty) {
      return res.status(400).json({ success: false, message: 'Subject code already exists.' });
    }

    const now = new Date().toISOString();
    const subData = {
      name: name.trim(),
      code: formattedCode,
      description: description ? description.trim() : '',
      icon: icon ? icon.trim() : 'book-open',
      color: color ? color.trim() : '#4f46e5',
      created_at: now,
      updated_at: now
    };

    const docRef = await db.collection('subjects').add(subData);

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully!',
      subjectId: docRef.id
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/subjects/:id - Admin Edit Subject
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, code, description, icon, color } = req.body;
    const subjectId = String(req.params.id);

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Subject name and code are required.' });
    }

    const formattedCode = code.trim().toUpperCase();
    const db = getDb();

    // Check code collision with other subjects
    const existing = await db.collection('subjects').where('code', '==', formattedCode).get();
    const isDuplicate = existing.docs.some(doc => doc.id !== subjectId);
    if (isDuplicate) {
      return res.status(400).json({ success: false, message: 'Subject code is already used by another subject.' });
    }

    const now = new Date().toISOString();
    await db.collection('subjects').doc(subjectId).update({
      name: name.trim(),
      code: formattedCode,
      description: description ? description.trim() : '',
      icon: icon ? icon.trim() : 'book-open',
      color: color ? color.trim() : '#4f46e5',
      updated_at: now
    });

    return res.json({
      success: true,
      message: 'Subject updated successfully!'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/subjects/:id - Admin Delete Subject
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const subjectId = String(req.params.id);
    const db = getDb();

    // Cascade delete tests & questions
    const testsSnap = await db.collection('tests').where('subject_id', '==', subjectId).get();
    for (const tDoc of testsSnap.docs) {
      const qSnap = await db.collection('questions').where('test_id', '==', String(tDoc.id)).get();
      for (const qDoc of qSnap.docs) {
        await db.collection('questions').doc(qDoc.id).delete();
      }
      await db.collection('tests').doc(tDoc.id).delete();
    }

    await db.collection('subjects').doc(subjectId).delete();

    return res.json({
      success: true,
      message: 'Subject deleted successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
