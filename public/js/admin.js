// Admin Panel Management Module
const Admin = {
  activeTab: 'overview',
  subjects: [],
  tests: [],
  questions: [],

  async init() {
    this.switchTab('overview');
  },

  async switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab headers
    document.querySelectorAll('.admin-nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // Toggle panes
    document.querySelectorAll('.admin-tab-pane').forEach(p => {
      p.style.display = 'none';
    });

    const activePane = document.getElementById(`admin-pane-${tabName}`);
    if (activePane) activePane.style.display = 'block';

    if (tabName === 'overview') this.loadOverview();
    if (tabName === 'subjects') this.loadSubjects();
    if (tabName === 'tests') this.loadTests();
    if (tabName === 'questions') this.loadQuestions();
    if (tabName === 'results') this.loadResults();
  },

  // ==========================================
  // 1. DASHBOARD OVERVIEW
  // ==========================================
  async loadOverview() {
    try {
      const data = await API.get('/api/admin/stats');
      const stats = data.stats;

      document.getElementById('stat-total-students').textContent = stats.totalStudents;
      document.getElementById('stat-total-subjects').textContent = stats.totalSubjects;
      document.getElementById('stat-total-tests').textContent = stats.totalTests;
      document.getElementById('stat-total-questions').textContent = stats.totalQuestions;
      document.getElementById('stat-total-attempts').textContent = stats.totalAttempts;
      document.getElementById('stat-pass-rate').textContent = `${stats.passRate}%`;

      const recentTable = document.getElementById('admin-recent-attempts-table');
      if (recentTable) {
        if (!data.recentAttempts || data.recentAttempts.length === 0) {
          recentTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No test attempts recorded yet.</td></tr>`;
        } else {
          recentTable.innerHTML = data.recentAttempts.map(a => `
            <tr>
              <td><strong>${escapeHtml(a.student_name)}</strong></td>
              <td>${escapeHtml(a.test_title)}</td>
              <td><span class="meta-badge">${escapeHtml(a.subject_name)}</span></td>
              <td><strong>${a.score} / ${a.total_marks} (${a.percentage}%)</strong></td>
              <td>
                <span class="review-status-tag ${a.status === 'passed' ? 'correct' : 'wrong'}">
                  ${a.status.toUpperCase()}
                </span>
              </td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="location.hash='#/result/${a.attempt_id}'">
                  <i class="fas fa-eye"></i> View
                </button>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  // ==========================================
  // 2. SUBJECTS MANAGEMENT
  // ==========================================
  async loadSubjects() {
    const tableBody = document.getElementById('admin-subjects-table-body');
    if (!tableBody) return;

    try {
      const data = await API.get('/api/subjects');
      this.subjects = data.subjects || [];

      if (this.subjects.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No subjects found. Click 'Add Subject' to create one.</td></tr>`;
        return;
      }

      tableBody.innerHTML = this.subjects.map(s => `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="meta-badge" style="color: ${s.color};">
                <i class="fas fa-${s.icon || 'book-open'}"></i>
              </span>
              <strong>${escapeHtml(s.name)}</strong>
            </div>
          </td>
          <td><code>${escapeHtml(s.code)}</code></td>
          <td style="max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted);">
            ${escapeHtml(s.description || '-')}
          </td>
          <td>${s.total_tests || 0} Tests</td>
          <td>${s.total_questions || 0} MCQs</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-secondary" onclick="Admin.openEditSubjectModal('${s.id}')">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="btn btn-sm btn-danger-outline" onclick="Admin.deleteSubject('${s.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  openAddSubjectModal() {
    document.getElementById('subject-modal-title').textContent = 'Add New Subject';
    document.getElementById('subject-form-id').value = '';
    document.getElementById('subject-form-name').value = '';
    document.getElementById('subject-form-code').value = '';
    document.getElementById('subject-form-description').value = '';
    document.getElementById('subject-form-icon').value = 'book-open';
    document.getElementById('subject-form-color').value = '#2563eb';
    App.openModal('modal-subject');
  },

  openEditSubjectModal(id) {
    const sub = this.subjects.find(s => String(s.id) === String(id));
    if (!sub) return;

    document.getElementById('subject-modal-title').textContent = 'Edit Subject';
    document.getElementById('subject-form-id').value = sub.id;
    document.getElementById('subject-form-name').value = sub.name;
    document.getElementById('subject-form-code').value = sub.code;
    document.getElementById('subject-form-description').value = sub.description || '';
    document.getElementById('subject-form-icon').value = sub.icon || 'book-open';
    document.getElementById('subject-form-color').value = sub.color || '#2563eb';
    App.openModal('modal-subject');
  },

  async saveSubject(e) {
    e.preventDefault();
    const id = document.getElementById('subject-form-id').value;
    const name = document.getElementById('subject-form-name').value.trim();
    const code = document.getElementById('subject-form-code').value.trim();
    const description = document.getElementById('subject-form-description').value.trim();
    const icon = document.getElementById('subject-form-icon').value.trim();
    const color = document.getElementById('subject-form-color').value.trim();

    try {
      if (id) {
        await API.put(`/api/subjects/${id}`, { name, code, description, icon, color });
        App.showToast('Subject updated successfully.', 'success');
      } else {
        await API.post('/api/subjects', { name, code, description, icon, color });
        App.showToast('Subject created successfully.', 'success');
      }
      App.closeModal('modal-subject');
      this.loadSubjects();
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  async deleteSubject(id) {
    if (!confirm('Are you sure you want to delete this subject? All associated tests and questions will also be deleted.')) return;
    try {
      await API.delete(`/api/subjects/${id}`);
      App.showToast('Subject deleted.', 'info');
      this.loadSubjects();
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  // ==========================================
  // 3. TESTS MANAGEMENT
  // ==========================================
  async loadTests() {
    const tableBody = document.getElementById('admin-tests-table-body');
    if (!tableBody) return;

    try {
      const data = await API.get('/api/tests');
      this.tests = data.tests || [];

      if (this.tests.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No tests found. Click 'Create Test' to create one.</td></tr>`;
        return;
      }

      tableBody.innerHTML = this.tests.map(t => `
        <tr>
          <td><strong>${escapeHtml(t.title)}</strong></td>
          <td><span class="meta-badge">${escapeHtml(t.subject_name)}</span></td>
          <td><i class="fas fa-clock" style="color: var(--primary);"></i> ${t.duration_minutes} Mins</td>
          <td>${t.question_count || 0} Questions</td>
          <td>${t.total_marks} Marks (${t.passing_percentage}% Pass)</td>
          <td>
            <span class="review-status-tag ${t.is_published ? 'correct' : 'skipped'}">
              ${t.is_published ? 'Published' : 'Draft'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-secondary" onclick="Admin.openQuestionsForTest('${t.id}')">
                <i class="fas fa-question-circle"></i> Questions
              </button>
              <button class="btn btn-sm btn-secondary" onclick="Admin.openEditTestModal('${t.id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger-outline" onclick="Admin.deleteTest('${t.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  async populateSubjectDropdown(selectId, selectedValue = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (this.subjects.length === 0) {
      const data = await API.get('/api/subjects');
      this.subjects = data.subjects || [];
    }

    select.innerHTML = '<option value="">-- Select Subject --</option>' + 
      this.subjects.map(s => `
        <option value="${s.id}" ${String(selectedValue) === String(s.id) ? 'selected' : ''}>
          ${escapeHtml(s.name)} (${s.code})
        </option>
      `).join('');
  },

  async openAddTestModal() {
    document.getElementById('test-modal-title').textContent = 'Create New MCQ Test';
    document.getElementById('test-form-id').value = '';
    document.getElementById('test-form-title').value = '';
    document.getElementById('test-form-description').value = '';
    document.getElementById('test-form-duration').value = '10';
    document.getElementById('test-form-marks').value = '10';
    document.getElementById('test-form-pass-pct').value = '40';
    document.getElementById('test-form-published').checked = true;

    await this.populateSubjectDropdown('test-form-subject');
    App.openModal('modal-test');
  },

  async openEditTestModal(id) {
    const test = this.tests.find(t => String(t.id) === String(id));
    if (!test) return;

    document.getElementById('test-modal-title').textContent = 'Edit Test';
    document.getElementById('test-form-id').value = test.id;
    document.getElementById('test-form-title').value = test.title;
    document.getElementById('test-form-description').value = test.description || '';
    document.getElementById('test-form-duration').value = test.duration_minutes;
    document.getElementById('test-form-marks').value = test.total_marks;
    document.getElementById('test-form-pass-pct').value = test.passing_percentage;
    document.getElementById('test-form-published').checked = Boolean(test.is_published);

    await this.populateSubjectDropdown('test-form-subject', test.subject_id);
    App.openModal('modal-test');
  },

  async saveTest(e) {
    e.preventDefault();
    const id = document.getElementById('test-form-id').value;
    const subject_id = document.getElementById('test-form-subject').value;
    const title = document.getElementById('test-form-title').value.trim();
    const description = document.getElementById('test-form-description').value.trim();
    const duration_minutes = document.getElementById('test-form-duration').value;
    const total_marks = document.getElementById('test-form-marks').value;
    const passing_percentage = document.getElementById('test-form-pass-pct').value;
    const is_published = document.getElementById('test-form-published').checked;

    if (!subject_id) {
      App.showToast('Please select a subject for this test.', 'warning');
      return;
    }

    try {
      if (id) {
        await API.put(`/api/tests/${id}`, { subject_id, title, description, duration_minutes, total_marks, passing_percentage, is_published });
        App.showToast('Test updated successfully.', 'success');
      } else {
        await API.post('/api/tests', { subject_id, title, description, duration_minutes, total_marks, passing_percentage, is_published });
        App.showToast('Test created successfully.', 'success');
      }
      App.closeModal('modal-test');
      this.loadTests();
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  async deleteTest(id) {
    if (!confirm('Are you sure you want to delete this test and all its questions?')) return;
    try {
      await API.delete(`/api/tests/${id}`);
      App.showToast('Test deleted.', 'info');
      this.loadTests();
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  // ==========================================
  // 4. QUESTIONS MANAGEMENT (One-by-One & Bulk Excel/CSV)
  // ==========================================
  parsedBulkRows: [],

  async openQuestionsForTest(testId) {
    await this.populateTestDropdown('admin-questions-test-filter', testId);
    this.switchTab('questions');
    this.filterQuestionsByTest(testId);
  },

  async loadQuestions() {
    await this.populateTestDropdown('admin-questions-test-filter');
    const testSelect = document.getElementById('admin-questions-test-filter');
    if (testSelect && testSelect.value) {
      this.filterQuestionsByTest(testSelect.value);
    } else {
      const container = document.getElementById('admin-questions-list');
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 2.5rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border);">
            <i class="fas fa-hand-pointer fa-2x" style="margin-bottom: 0.75rem;"></i>
            <p>Please select a test from the dropdown above to view or manage questions.</p>
          </div>
        `;
      }
    }
  },

  async populateTestDropdown(selectId, selectedValue = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (this.tests.length === 0) {
      const data = await API.get('/api/tests');
      this.tests = data.tests || [];
    }

    select.innerHTML = '<option value="">-- Select a Test --</option>' + 
      this.tests.map(t => `
        <option value="${t.id}" ${String(selectedValue) === String(t.id) ? 'selected' : ''}>
          ${escapeHtml(t.title)} (${escapeHtml(t.subject_name)})
        </option>
      `).join('');
  },

  async filterQuestionsByTest(testId) {
    const container = document.getElementById('admin-questions-list');
    if (!testId) {
      container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Please select a test.</div>`;
      return;
    }

    try {
      const data = await API.get(`/api/questions/test/${testId}`);
      this.questions = data.questions || [];

      if (this.questions.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border);">
            <i class="fas fa-question fa-3x" style="color: var(--text-muted); margin-bottom: 1rem;"></i>
            <h3>No Questions in this Test</h3>
            <p style="color: var(--text-muted); margin: 0.5rem 0 1.25rem;">Choose one of the options below to add 4-option MCQs to this test.</p>
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="Admin.openAddQuestionModal()">
                <i class="fas fa-plus"></i> Add One-by-One
              </button>
              <button class="btn btn-secondary" onclick="Admin.openBulkUploadModal()">
                <i class="fas fa-file-excel" style="color: #10b981;"></i> Bulk Upload (Excel / CSV)
              </button>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = this.questions.map((q, idx) => {
        const diff = q.difficulty || 'Medium';
        let diffBadgeClass = 'badge-medium';
        if (diff === 'Easy') diffBadgeClass = 'badge-easy';
        if (diff === 'Hard') diffBadgeClass = 'badge-hard';

        return `
          <div class="review-item" style="margin-bottom: 1.25rem;">
            <div class="review-item-header">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span class="question-number-badge">Question ${idx + 1}</span>
                <span class="difficulty-badge ${diffBadgeClass}">${diff}</span>
                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);"><i class="fas fa-star" style="color: var(--warning);"></i> ${q.marks || 1} Marks</span>
              </div>
              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-sm btn-secondary" onclick="Admin.openEditQuestionModal('${q.id}')">
                  <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger-outline" onclick="Admin.deleteQuestion('${q.id}')">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <div class="question-text" style="font-size: 1.05rem; margin-bottom: 1rem;">
              ${escapeHtml(q.question_text)}
            </div>

            <div class="review-options">
              <div class="review-option ${q.correct_option === 'A' ? 'is-correct-answer' : ''}">
                <strong>A.</strong> <span>${escapeHtml(q.option_a)}</span>
                ${q.correct_option === 'A' ? '<span style="font-size:0.75rem; background:var(--success); color:#fff; padding:2px 8px; border-radius:4px; font-weight:600;">Correct Answer</span>' : ''}
              </div>
              <div class="review-option ${q.correct_option === 'B' ? 'is-correct-answer' : ''}">
                <strong>B.</strong> <span>${escapeHtml(q.option_b)}</span>
                ${q.correct_option === 'B' ? '<span style="font-size:0.75rem; background:var(--success); color:#fff; padding:2px 8px; border-radius:4px; font-weight:600;">Correct Answer</span>' : ''}
              </div>
              <div class="review-option ${q.correct_option === 'C' ? 'is-correct-answer' : ''}">
                <strong>C.</strong> <span>${escapeHtml(q.option_c)}</span>
                ${q.correct_option === 'C' ? '<span style="font-size:0.75rem; background:var(--success); color:#fff; padding:2px 8px; border-radius:4px; font-weight:600;">Correct Answer</span>' : ''}
              </div>
              <div class="review-option ${q.correct_option === 'D' ? 'is-correct-answer' : ''}">
                <strong>D.</strong> <span>${escapeHtml(q.option_d)}</span>
                ${q.correct_option === 'D' ? '<span style="font-size:0.75rem; background:var(--success); color:#fff; padding:2px 8px; border-radius:4px; font-weight:600;">Correct Answer</span>' : ''}
              </div>
            </div>

            ${q.why_answer ? `
              <div class="question-explanation-box">
                <div class="explanation-title"><i class="fas fa-lightbulb"></i> Why Answer / Explanation:</div>
                ${escapeHtml(q.why_answer)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  // ------------------------------------------
  // ONE-BY-ONE QUESTION METHODS
  // ------------------------------------------
  async openAddQuestionModal() {
    const currentTestFilter = document.getElementById('admin-questions-test-filter').value;
    
    // Ensure subjects & tests are loaded
    if (this.subjects.length === 0) {
      const data = await API.get('/api/subjects');
      this.subjects = data.subjects || [];
    }
    if (this.tests.length === 0) {
      const data = await API.get('/api/tests');
      this.tests = data.tests || [];
    }

    let defaultSubjectId = '';
    let defaultTestId = currentTestFilter || '';

    if (defaultTestId) {
      const t = this.tests.find(item => String(item.id) === String(defaultTestId));
      if (t) defaultSubjectId = String(t.subject_id);
    } else if (this.subjects.length > 0) {
      defaultSubjectId = String(this.subjects[0].id);
    }

    // Populate subject select
    const subjectSelect = document.getElementById('question-form-subject-select');
    if (subjectSelect) {
      subjectSelect.innerHTML = this.subjects.map(s => `
        <option value="${s.id}" ${String(s.id) === String(defaultSubjectId) ? 'selected' : ''}>
          ${escapeHtml(s.name)} (${escapeHtml(s.code)})
        </option>
      `).join('');
    }

    // Populate test select for that subject
    this.populateModalTests(defaultSubjectId, defaultTestId);

    document.getElementById('question-modal-title').textContent = 'Add Question (One-by-One)';
    document.getElementById('question-form-id').value = '';
    document.getElementById('question-form-text').value = '';
    document.getElementById('question-form-opt-a').value = '';
    document.getElementById('question-form-opt-b').value = '';
    document.getElementById('question-form-opt-c').value = '';
    document.getElementById('question-form-opt-d').value = '';
    document.getElementById('question-form-correct-a').checked = true;
    document.getElementById('question-form-why-answer').value = '';
    document.getElementById('question-form-marks').value = '1';
    document.getElementById('question-form-difficulty').value = 'Medium';

    App.openModal('modal-question');
  },

  handleModalSubjectChange(subjectId) {
    this.populateModalTests(subjectId);
  },

  populateModalTests(subjectId, selectedTestId = null) {
    const testSelect = document.getElementById('question-form-test-id');
    if (!testSelect) return;

    const filteredTests = this.tests.filter(t => String(t.subject_id) === String(subjectId));
    if (filteredTests.length === 0) {
      testSelect.innerHTML = '<option value="">-- No tests found in this subject --</option>';
      return;
    }

    testSelect.innerHTML = filteredTests.map(t => `
      <option value="${t.id}" ${String(t.id) === String(selectedTestId) ? 'selected' : ''}>
        ${escapeHtml(t.title)}
      </option>
    `).join('');
  },

  async openEditQuestionModal(id) {
    const q = this.questions.find(item => String(item.id) === String(id));
    if (!q) return;

    // Ensure tests & subjects are loaded
    if (this.subjects.length === 0) {
      const data = await API.get('/api/subjects');
      this.subjects = data.subjects || [];
    }
    if (this.tests.length === 0) {
      const data = await API.get('/api/tests');
      this.tests = data.tests || [];
    }

    const test = this.tests.find(t => String(t.id) === String(q.test_id));
    const subjectId = test ? String(test.subject_id) : (this.subjects[0]?.id || '');

    // Populate subject select
    const subjectSelect = document.getElementById('question-form-subject-select');
    if (subjectSelect) {
      subjectSelect.innerHTML = this.subjects.map(s => `
        <option value="${s.id}" ${String(s.id) === String(subjectId) ? 'selected' : ''}>
          ${escapeHtml(s.name)} (${escapeHtml(s.code)})
        </option>
      `).join('');
    }

    // Populate test select
    this.populateModalTests(subjectId, q.test_id);

    document.getElementById('question-modal-title').textContent = 'Edit Question';
    document.getElementById('question-form-id').value = q.id;
    document.getElementById('question-form-text').value = q.question_text;
    document.getElementById('question-form-opt-a').value = q.option_a;
    document.getElementById('question-form-opt-b').value = q.option_b;
    document.getElementById('question-form-opt-c').value = q.option_c;
    document.getElementById('question-form-opt-d').value = q.option_d;
    document.getElementById('question-form-why-answer').value = q.why_answer || '';
    document.getElementById('question-form-marks').value = q.marks || 1;
    document.getElementById('question-form-difficulty').value = q.difficulty || 'Medium';

    const rad = document.querySelector(`input[name="correct_option"][value="${q.correct_option}"]`);
    if (rad) rad.checked = true;

    App.openModal('modal-question');
  },

  async saveQuestion(e) {
    e.preventDefault();
    const id = document.getElementById('question-form-id').value;
    const test_id = document.getElementById('question-form-test-id').value;
    const question_text = document.getElementById('question-form-text').value.trim();
    const option_a = document.getElementById('question-form-opt-a').value.trim();
    const option_b = document.getElementById('question-form-opt-b').value.trim();
    const option_c = document.getElementById('question-form-opt-c').value.trim();
    const option_d = document.getElementById('question-form-opt-d').value.trim();
    const why_answer = document.getElementById('question-form-why-answer').value.trim();
    const marks = document.getElementById('question-form-marks').value;
    const difficulty = document.getElementById('question-form-difficulty').value;

    const correctRadio = document.querySelector('input[name="correct_option"]:checked');
    const correct_option = correctRadio ? correctRadio.value : 'A';

    if (!test_id) {
      App.showToast('Please select a target test.', 'warning');
      return;
    }

    if (!question_text || !option_a || !option_b || !option_c || !option_d) {
      App.showToast('Please provide question text and all 4 options.', 'warning');
      return;
    }

    try {
      if (id) {
        await API.put(`/api/questions/${id}`, { test_id, question_text, option_a, option_b, option_c, option_d, correct_option, why_answer, marks, difficulty });
        App.showToast('Question updated successfully.', 'success');
      } else {
        await API.post('/api/questions', { test_id, question_text, option_a, option_b, option_c, option_d, correct_option, why_answer, marks, difficulty });
        App.showToast('Question added successfully.', 'success');
      }
      App.closeModal('modal-question');

      // Update test filter dropdown if it changed
      const currentTestFilter = document.getElementById('admin-questions-test-filter');
      if (currentTestFilter.value !== test_id) {
        currentTestFilter.value = test_id;
      }
      this.filterQuestionsByTest(test_id);
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  async deleteQuestion(id) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const test_id = document.getElementById('admin-questions-test-filter').value;
      await API.delete(`/api/questions/${id}`);
      App.showToast('Question deleted.', 'info');
      this.filterQuestionsByTest(test_id);
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  // ------------------------------------------
  // BULK UPLOAD (EXCEL / CSV) METHODS
  // ------------------------------------------
  async openBulkUploadModal() {
    const currentTestFilter = document.getElementById('admin-questions-test-filter').value;

    // Ensure subjects & tests are loaded
    if (this.subjects.length === 0) {
      const data = await API.get('/api/subjects');
      this.subjects = data.subjects || [];
    }
    if (this.tests.length === 0) {
      const data = await API.get('/api/tests');
      this.tests = data.tests || [];
    }

    let defaultSubjectId = '';
    let defaultTestId = currentTestFilter || '';

    if (defaultTestId) {
      const t = this.tests.find(item => String(item.id) === String(defaultTestId));
      if (t) defaultSubjectId = String(t.subject_id);
    } else if (this.subjects.length > 0) {
      defaultSubjectId = String(this.subjects[0].id);
    }

    // Populate bulk subject select
    const subjectSelect = document.getElementById('bulk-form-subject-select');
    if (subjectSelect) {
      subjectSelect.innerHTML = this.subjects.map(s => `
        <option value="${s.id}" ${String(s.id) === String(defaultSubjectId) ? 'selected' : ''}>
          ${escapeHtml(s.name)} (${escapeHtml(s.code)})
        </option>
      `).join('');
    }

    // Populate bulk test select
    this.populateBulkModalTests(defaultSubjectId, defaultTestId);

    // Reset file dropzone & preview state
    this.parsedBulkRows = [];
    const fileInput = document.getElementById('bulk-file-input');
    if (fileInput) fileInput.value = '';

    document.getElementById('dropzone-prompt').style.display = 'block';
    document.getElementById('dropzone-file-info').style.display = 'none';
    document.getElementById('bulk-preview-section').style.display = 'none';
    document.getElementById('btn-import-bulk').disabled = true;

    // Setup drag & drop handlers
    this.setupDropzone();

    App.openModal('modal-bulk-question');
  },

  handleBulkSubjectChange(subjectId) {
    this.populateBulkModalTests(subjectId);
    this.updateBulkImportButtonState();
  },

  handleBulkTestChange(testId) {
    this.updateBulkImportButtonState();
  },

  populateBulkModalTests(subjectId, selectedTestId = null) {
    const testSelect = document.getElementById('bulk-form-test-select');
    if (!testSelect) return;

    const filteredTests = this.tests.filter(t => String(t.subject_id) === String(subjectId));
    if (filteredTests.length === 0) {
      testSelect.innerHTML = '<option value="">-- No tests available for this subject --</option>';
      return;
    }

    testSelect.innerHTML = filteredTests.map(t => `
      <option value="${t.id}" ${String(t.id) === String(selectedTestId) ? 'selected' : ''}>
        ${escapeHtml(t.title)}
      </option>
    `).join('');
  },

  setupDropzone() {
    const dropzone = document.getElementById('bulk-upload-dropzone');
    if (!dropzone || dropzone.dataset.initialized === 'true') return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        this.processUploadedFile(files[0]);
      }
    });

    dropzone.dataset.initialized = 'true';
  },

  handleFileInputChange(input) {
    if (input.files && input.files.length > 0) {
      this.processUploadedFile(input.files[0]);
    }
  },

  // Download Excel (.xlsx) Template using SheetJS
  downloadExcelTemplate() {
    try {
      if (typeof XLSX === 'undefined') {
        window.location.href = '/api/questions/template/csv';
        return;
      }

      const sampleData = [
        {
          "Question": "What is the output of typeof null in JavaScript?",
          "Option A": "object",
          "Option B": "null",
          "Option C": "undefined",
          "Option D": "number",
          "Correct Answer": "A",
          "Why Answer": "In JavaScript, typeof null evaluates to 'object' due to an intentional legacy design decision from JS 1.0.",
          "Marks": 1,
          "Difficulty": "Easy"
        },
        {
          "Question": "Which CSS property is used to control the stacking order of positioned elements?",
          "Option A": "display",
          "Option B": "position",
          "Option C": "z-index",
          "Option D": "flex-direction",
          "Correct Answer": "C",
          "Why Answer": "The z-index CSS property sets the z-order of a positioned element and its descendants or flex/grid items.",
          "Marks": 1,
          "Difficulty": "Medium"
        },
        {
          "Question": "What is the worst-case time complexity of QuickSort with standard partition?",
          "Option A": "O(n log n)",
          "Option B": "O(n)",
          "Option C": "O(1)",
          "Option D": "O(n^2)",
          "Correct Answer": "D",
          "Why Answer": "When the chosen pivot is always the smallest or largest element (e.g. sorted array), recursion depth becomes n and comparisons become O(n^2).",
          "Marks": 2,
          "Difficulty": "Hard"
        }
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData, {
        header: ["Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Why Answer", "Marks", "Difficulty"]
      });

      // Auto-size columns for better usability
      ws['!cols'] = [
        { wch: 45 }, // Question
        { wch: 20 }, // Option A
        { wch: 20 }, // Option B
        { wch: 20 }, // Option C
        { wch: 20 }, // Option D
        { wch: 15 }, // Correct Answer
        { wch: 40 }, // Why Answer
        { wch: 10 }, // Marks
        { wch: 15 }  // Difficulty
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Questions Template");
      XLSX.writeFile(wb, "mcq_questions_template.xlsx");
      App.showToast('Excel template downloaded successfully.', 'success');
    } catch (err) {
      console.error('Error generating Excel template:', err);
      // Fallback to CSV endpoint
      window.location.href = '/api/questions/template/csv';
    }
  },

  downloadCsvTemplate() {
    window.location.href = '/api/questions/template/csv';
  },

  processUploadedFile(file) {
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      App.showToast('Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV file.', 'danger');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        if (typeof XLSX === 'undefined') {
          throw new Error('SheetJS library is not loaded. Please ensure you have internet access or try CSV.');
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          App.showToast('The uploaded sheet is empty.', 'warning');
          return;
        }

        this.validateAndPreviewBulkData(rawJson, file.name, file.size);
      } catch (err) {
        console.error('Error parsing file:', err);
        App.showToast('Failed to parse file: ' + err.message, 'danger');
      }
    };

    reader.onerror = () => {
      App.showToast('Error reading uploaded file.', 'danger');
    };

    reader.readAsArrayBuffer(file);
  },

  validateAndPreviewBulkData(rawRows, fileName, fileSize) {
    // Show file info in dropzone
    document.getElementById('dropzone-prompt').style.display = 'none';
    const infoBox = document.getElementById('dropzone-file-info');
    infoBox.style.display = 'flex';
    document.getElementById('bulk-file-name').textContent = fileName;
    document.getElementById('bulk-file-size').textContent = `${(fileSize / 1024).toFixed(1)} KB • ${rawRows.length} rows detected`;

    const parsedRows = [];
    const validOptions = ['A', 'B', 'C', 'D'];
    const validDifficulties = ['Easy', 'Medium', 'Hard'];

    rawRows.forEach((row, idx) => {
      // Flexible key finder (case-insensitive & whitespace tolerant)
      const findVal = (possibleKeys) => {
        const rowKeys = Object.keys(row);
        for (const pk of possibleKeys) {
          const matched = rowKeys.find(k => k.trim().toLowerCase().replace(/[\s_-]/g, '') === pk.toLowerCase().replace(/[\s_-]/g, ''));
          if (matched && row[matched] !== undefined && row[matched] !== null && String(row[matched]).trim() !== '') {
            return String(row[matched]).trim();
          }
        }
        return '';
      };

      const question_text = findVal(['Question', 'question_text', 'question', 'questiontext']);
      const option_a = findVal(['Option A', 'option_a', 'optiona', 'OptionA', 'opt_a', 'opta']);
      const option_b = findVal(['Option B', 'option_b', 'optionb', 'OptionB', 'opt_b', 'optb']);
      const option_c = findVal(['Option C', 'option_c', 'optionc', 'OptionC', 'opt_c', 'optc']);
      const option_d = findVal(['Option D', 'option_d', 'optiond', 'OptionD', 'opt_d', 'optd']);
      let correct_option = findVal(['Correct Answer', 'correct_option', 'correctanswer', 'correctoption', 'Correct Option', 'Answer', 'answer', 'correct']);
      const why_answer = findVal(['Why Answer', 'why_answer', 'whyanswer', 'explanation', 'Rationale', 'reason', 'why']);
      const marksRaw = findVal(['Marks', 'marks', 'mark', 'points', 'score']);
      const diffRaw = findVal(['Difficulty', 'difficulty', 'diff', 'level']);

      // Format correct option
      let formattedCorrect = correct_option.toUpperCase().trim();
      if (formattedCorrect.length > 1) {
        const charMatch = formattedCorrect.match(/[A-D]/);
        if (charMatch) formattedCorrect = charMatch[0];
      }

      // Format difficulty
      let formattedDiff = 'Medium';
      if (diffRaw) {
        const match = validDifficulties.find(d => d.toLowerCase() === diffRaw.toLowerCase());
        if (match) formattedDiff = match;
      }

      const marks = parseInt(marksRaw, 10) || 1;

      // Validation checks
      const errors = [];
      if (!question_text) errors.push('Missing Question');
      if (!option_a) errors.push('Missing Option A');
      if (!option_b) errors.push('Missing Option B');
      if (!option_c) errors.push('Missing Option C');
      if (!option_d) errors.push('Missing Option D');
      if (!validOptions.includes(formattedCorrect)) errors.push(`Invalid Correct Answer '${correct_option || 'Empty'}'`);

      const isValid = errors.length === 0;

      parsedRows.push({
        rowNumber: idx + 1,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option: formattedCorrect,
        why_answer,
        marks,
        difficulty: formattedDiff,
        isValid,
        errors
      });
    });

    this.parsedBulkRows = parsedRows;
    this.renderBulkPreview();
    this.updateBulkImportButtonState();
  },

  renderBulkPreview() {
    const section = document.getElementById('bulk-preview-section');
    const tableBody = document.getElementById('bulk-preview-table-body');
    const summaryContainer = document.getElementById('bulk-validation-summary');

    if (!section || !tableBody) return;

    section.style.display = 'block';

    const total = this.parsedBulkRows.length;
    const validCount = this.parsedBulkRows.filter(r => r.isValid).length;
    const invalidCount = total - validCount;

    summaryContainer.innerHTML = `
      <span class="val-badge val-badge-info"><i class="fas fa-list-ol"></i> Total: ${total}</span>
      <span class="val-badge val-badge-valid"><i class="fas fa-check-circle"></i> Valid: ${validCount}</span>
      ${invalidCount > 0 ? `<span class="val-badge val-badge-invalid"><i class="fas fa-exclamation-triangle"></i> Errors: ${invalidCount}</span>` : ''}
    `;

    tableBody.innerHTML = this.parsedBulkRows.map(r => {
      const diffClass = r.difficulty === 'Easy' ? 'badge-easy' : (r.difficulty === 'Hard' ? 'badge-hard' : 'badge-medium');
      const statusBadge = r.isValid
        ? `<span class="val-badge val-badge-valid"><i class="fas fa-check"></i> Valid</span>`
        : `<span class="val-badge val-badge-invalid" title="${escapeHtml(r.errors.join(', '))}"><i class="fas fa-times"></i> ${escapeHtml(r.errors[0])}</span>`;

      return `
        <tr class="${r.isValid ? '' : 'row-invalid'}">
          <td><strong>${r.rowNumber}</strong></td>
          <td>${statusBadge}</td>
          <td><div style="max-height: 48px; overflow: hidden; text-overflow: ellipsis; font-weight: 500; color: var(--text-main);">${escapeHtml(r.question_text || '-')}</div></td>
          <td>${escapeHtml(r.option_a || '-')}</td>
          <td>${escapeHtml(r.option_b || '-')}</td>
          <td>${escapeHtml(r.option_c || '-')}</td>
          <td>${escapeHtml(r.option_d || '-')}</td>
          <td><strong style="color: var(--success);">${r.correct_option || '-'}</strong></td>
          <td><span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(r.why_answer || '-')}</span></td>
          <td>${r.marks}</td>
          <td><span class="difficulty-badge ${diffClass}">${r.difficulty}</span></td>
        </tr>
      `;
    }).join('');
  },

  updateBulkImportButtonState() {
    const importBtn = document.getElementById('btn-import-bulk');
    const testSelect = document.getElementById('bulk-form-test-select');
    if (!importBtn) return;

    const validCount = this.parsedBulkRows.filter(r => r.isValid).length;
    const hasTargetTest = testSelect && testSelect.value;

    if (validCount > 0 && hasTargetTest) {
      importBtn.disabled = false;
      importBtn.innerHTML = `<i class="fas fa-file-import"></i> Import ${validCount} Valid Question${validCount === 1 ? '' : 's'}`;
    } else {
      importBtn.disabled = true;
      importBtn.innerHTML = `<i class="fas fa-file-import"></i> Import Questions`;
    }
  },

  async importBulkQuestions() {
    const testSelect = document.getElementById('bulk-form-test-select');
    const test_id = testSelect ? testSelect.value : null;

    if (!test_id) {
      App.showToast('Please select a target test for the imported questions.', 'warning');
      return;
    }

    const validQuestions = this.parsedBulkRows
      .filter(r => r.isValid)
      .map(r => ({
        question_text: r.question_text,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        correct_option: r.correct_option,
        why_answer: r.why_answer,
        marks: r.marks,
        difficulty: r.difficulty
      }));

    if (validQuestions.length === 0) {
      App.showToast('No valid questions found to import.', 'warning');
      return;
    }

    const importBtn = document.getElementById('btn-import-bulk');
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Importing...`;
    }

    try {
      const res = await API.post('/api/questions/bulk', {
        test_id,
        questions: validQuestions
      });

      if (res.success) {
        App.showToast(`Successfully imported ${res.importedCount} questions!`, 'success');
        App.closeModal('modal-bulk-question');

        // Update test filter dropdown and refresh list
        const testFilter = document.getElementById('admin-questions-test-filter');
        if (testFilter) {
          testFilter.value = test_id;
        }
        await this.loadTests();
        await this.loadStats();
        this.filterQuestionsByTest(test_id);
      } else {
        throw new Error(res.message || 'Import failed.');
      }
    } catch (err) {
      App.showToast(err.message, 'danger');
    } finally {
      if (importBtn) {
        this.updateBulkImportButtonState();
      }
    }
  },

  // ==========================================
  // 5. ALL RESULTS / SUBMISSIONS
  // ==========================================
  async loadResults() {
    const tableBody = document.getElementById('admin-all-results-table-body');
    if (!tableBody) return;

    try {
      const data = await API.get('/api/results/all');
      const results = data.results || [];

      if (results.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No student test submissions found.</td></tr>`;
        return;
      }

      tableBody.innerHTML = results.map(r => {
        const dateStr = new Date(r.submitted_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        return `
          <tr>
            <td>
              <strong>${escapeHtml(r.student_name)}</strong><br>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(r.student_email)}</span>
            </td>
            <td><strong>${escapeHtml(r.test_title)}</strong></td>
            <td><span class="meta-badge">${escapeHtml(r.subject_name)}</span></td>
            <td><strong>${r.score} / ${r.total_marks} (${r.percentage}%)</strong></td>
            <td>
              <span class="review-status-tag ${r.status === 'passed' ? 'correct' : 'wrong'}">
                ${r.status.toUpperCase()}
              </span>
            </td>
            <td><span style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</span></td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="location.hash='#/result/${r.attempt_id}'">
                <i class="fas fa-eye"></i> View Result
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  }
};
