const express = require('express');
const router = express.Router();
const { getDb } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

// GET /api/questions/test/:testId - Admin view all questions for a test
router.get('/test/:testId', requireAdmin, async (req, res) => {
  try {
    const testId = String(req.params.testId);
    const db = getDb();
    const questionsSnap = await db.collection('questions').where('test_id', '==', testId).get();

    const questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort questions by created_at or id
    questions.sort((a, b) => (new Date(a.created_at || 0)) - (new Date(b.created_at || 0)));

    return res.json({ success: true, questions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/questions - Admin Add Question (Strictly 4 Options)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, why_answer, difficulty } = req.body;

    if (!test_id || !question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
      return res.status(400).json({
        success: false,
        message: 'All fields (Question text, Option A, Option B, Option C, Option D, and Correct Option) are required.'
      });
    }

    const validOptions = ['A', 'B', 'C', 'D'];
    const formattedCorrectOption = String(correct_option).toUpperCase().trim();

    if (!validOptions.includes(formattedCorrectOption)) {
      return res.status(400).json({
        success: false,
        message: 'Correct option must be one of: A, B, C, or D.'
      });
    }

    const validDifficulties = ['Easy', 'Medium', 'Hard'];
    let formattedDifficulty = 'Medium';
    if (difficulty && validDifficulties.includes(difficulty.trim())) {
      formattedDifficulty = difficulty.trim();
    } else if (difficulty) {
      const match = validDifficulties.find(d => d.toLowerCase() === String(difficulty).toLowerCase().trim());
      if (match) formattedDifficulty = match;
    }

    const questionMarks = parseInt(marks, 10) || 1;
    const now = new Date().toISOString();
    const db = getDb();

    const qData = {
      test_id: String(test_id),
      question_text: String(question_text).trim(),
      option_a: String(option_a).trim(),
      option_b: String(option_b).trim(),
      option_c: String(option_c).trim(),
      option_d: String(option_d).trim(),
      correct_option: formattedCorrectOption,
      why_answer: why_answer ? String(why_answer).trim() : '',
      difficulty: formattedDifficulty,
      marks: questionMarks,
      created_at: now,
      updated_at: now
    };

    const docRef = await db.collection('questions').add(qData);

    return res.status(201).json({
      success: true,
      message: 'Question added successfully!',
      questionId: docRef.id,
      question: { id: docRef.id, ...qData }
    });
  } catch (err) {
    console.error('Create question error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/questions/bulk - Admin Bulk Import Questions (Excel / CSV)
router.post('/bulk', requireAdmin, async (req, res) => {
  try {
    const { test_id, questions } = req.body;

    if (!test_id) {
      return res.status(400).json({
        success: false,
        message: 'Target Test is required for importing questions.'
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions provided for bulk import.'
      });
    }

    const db = getDb();
    const testDoc = await db.collection('tests').doc(String(test_id)).get();
    if (!testDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Target test not found.'
      });
    }

    const validOptions = ['A', 'B', 'C', 'D'];
    const validDifficulties = ['Easy', 'Medium', 'Hard'];
    const now = new Date().toISOString();
    const insertedQuestions = [];
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const rowNum = i + 1;

      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
        errors.push(`Row ${rowNum}: Question text, 4 options, and correct option are required.`);
        continue;
      }

      let correctOpt = String(q.correct_option).toUpperCase().trim();
      // Handle cases like "Option A" or "A." or "a"
      if (correctOpt.length > 1) {
        const charMatch = correctOpt.match(/[A-D]/);
        if (charMatch) correctOpt = charMatch[0];
      }

      if (!validOptions.includes(correctOpt)) {
        errors.push(`Row ${rowNum}: Invalid correct option '${q.correct_option}'. Must be A, B, C, or D.`);
        continue;
      }

      let formattedDifficulty = 'Medium';
      if (q.difficulty) {
        const match = validDifficulties.find(d => d.toLowerCase() === String(q.difficulty).toLowerCase().trim());
        if (match) formattedDifficulty = match;
      }

      const marks = parseInt(q.marks, 10) || 1;

      const qData = {
        test_id: String(test_id),
        question_text: String(q.question_text).trim(),
        option_a: String(q.option_a).trim(),
        option_b: String(q.option_b).trim(),
        option_c: String(q.option_c).trim(),
        option_d: String(q.option_d).trim(),
        correct_option: correctOpt,
        why_answer: q.why_answer ? String(q.why_answer).trim() : '',
        difficulty: formattedDifficulty,
        marks: marks,
        created_at: now,
        updated_at: now
      };

      const docRef = await db.collection('questions').add(qData);
      insertedQuestions.push({ id: docRef.id, ...qData });
    }

    if (insertedQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid questions could be imported.',
        errors
      });
    }

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${insertedQuestions.length} question${insertedQuestions.length === 1 ? '' : 's'}!`,
      importedCount: insertedQuestions.length,
      totalProcessed: questions.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Bulk import questions error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/questions/template/csv - Download CSV template with proper headers and sample rows
router.get('/template/csv', (req, res) => {
  const headers = 'Question,Option A,Option B,Option C,Option D,Correct Answer,Why Answer,Marks,Difficulty\n';
  const sample1 = '"What is the output of typeof null in JavaScript?","object","null","undefined","number","A","In JavaScript, typeof null returns \'object\' due to a historical legacy bug in the language design.",1,"Easy"\n';
  const sample2 = '"Which CSS property controls the stacking order of positioned elements?","display","position","z-index","flex-direction","C","The z-index property specifies the stack level of an element in the current stacking context.",1,"Medium"\n';
  const sample3 = '"What is the time complexity of searching an element in a balanced Binary Search Tree (BST)?","O(1)","O(log n)","O(n)","O(n log n)","B","In a balanced BST like AVL or Red-Black Tree, height is log(n), making search operations take O(log n) time.",2,"Hard"\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mcq_questions_template.csv"');
  return res.send(headers + sample1 + sample2 + sample3);
});

// PUT /api/questions/:id - Admin Update Question
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const questionId = String(req.params.id);
    const { test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, why_answer, difficulty } = req.body;

    if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
      return res.status(400).json({
        success: false,
        message: 'All question fields and 4 options are required.'
      });
    }

    const validOptions = ['A', 'B', 'C', 'D'];
    const formattedCorrectOption = String(correct_option).toUpperCase().trim();

    if (!validOptions.includes(formattedCorrectOption)) {
      return res.status(400).json({
        success: false,
        message: 'Correct option must be one of: A, B, C, or D.'
      });
    }

    const validDifficulties = ['Easy', 'Medium', 'Hard'];
    let formattedDifficulty = 'Medium';
    if (difficulty && validDifficulties.includes(difficulty.trim())) {
      formattedDifficulty = difficulty.trim();
    } else if (difficulty) {
      const match = validDifficulties.find(d => d.toLowerCase() === String(difficulty).toLowerCase().trim());
      if (match) formattedDifficulty = match;
    }

    const questionMarks = parseInt(marks, 10) || 1;
    const now = new Date().toISOString();
    const db = getDb();

    const updateData = {
      question_text: String(question_text).trim(),
      option_a: String(option_a).trim(),
      option_b: String(option_b).trim(),
      option_c: String(option_c).trim(),
      option_d: String(option_d).trim(),
      correct_option: formattedCorrectOption,
      why_answer: why_answer !== undefined ? String(why_answer).trim() : '',
      difficulty: formattedDifficulty,
      marks: questionMarks,
      updated_at: now
    };

    if (test_id) {
      updateData.test_id = String(test_id);
    }

    await db.collection('questions').doc(questionId).update(updateData);

    return res.json({
      success: true,
      message: 'Question updated successfully!'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/questions/:id - Admin Delete Question
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const questionId = String(req.params.id);
    const db = getDb();
    await db.collection('questions').doc(questionId).delete();
    return res.json({
      success: true,
      message: 'Question deleted successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
