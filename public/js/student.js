// Student Features Module
const Student = {
  currentSubject: null,
  currentTest: null,
  allTestsList: [],
  allSubjectsList: [],
  userHistoryMap: {},
  searchQuery: '',
  selectedSubjectFilter: '',

  async loadAllTests() {
    const grid = document.getElementById('all-tests-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i>
        <p style="margin-top: 0.75rem; font-weight: 500;">Loading all assigned tests & quizzes...</p>
      </div>
    `;

    try {
      // Fetch both tests and user history in parallel
      const [testsData, subjectsData, historyData] = await Promise.all([
        API.get('/api/tests'),
        API.get('/api/subjects'),
        API.getUser() ? API.get('/api/results/my-history').catch(() => ({ results: [] })) : Promise.resolve({ results: [] })
      ]);

      this.allTestsList = testsData.tests || [];
      this.allSubjectsList = subjectsData.subjects || [];

      // Map user's latest attempt for each test
      this.userHistoryMap = {};
      if (historyData && historyData.results) {
        historyData.results.forEach(r => {
          if (!this.userHistoryMap[r.test_id]) {
            this.userHistoryMap[r.test_id] = r;
          }
        });
      }

      // Populate subject filter dropdown
      const filterSelect = document.getElementById('all-tests-subject-filter');
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Subjects</option>' +
          this.allSubjectsList.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      }

      this.renderAllTests();
    } catch (err) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--danger); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border);">
          <i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom: 0.5rem;"></i>
          <p>Error loading tests: ${err.message}</p>
        </div>
      `;
    }
  },

  renderAllTests() {
    const grid = document.getElementById('all-tests-grid');
    if (!grid) return;

    let filtered = this.allTestsList;

    if (this.selectedSubjectFilter) {
      filtered = filtered.filter(t => String(t.subject_id) === String(this.selectedSubjectFilter));
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.subject_name && t.subject_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3.5rem 1.5rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border);">
          <i class="fas fa-clipboard-check fa-3x" style="color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.25rem;">No Tests Found</h3>
          <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">
            ${this.searchQuery || this.selectedSubjectFilter 
              ? 'No tests match your current search or filter. Try clearing filters.' 
              : 'The administrator has not published any tests yet. Once created in the Admin portal, they will appear here automatically.'}
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(test => {
      const lastAttempt = this.userHistoryMap[test.id];
      const isAttempted = !!lastAttempt;
      const isPassed = isAttempted && lastAttempt.status === 'passed';

      let statusBadge = `<span class="review-status-tag" style="background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3);"><i class="fas fa-bullseye"></i> Assigned & Ready</span>`;
      if (isAttempted) {
        statusBadge = isPassed
          ? `<span class="review-status-tag correct"><i class="fas fa-check-circle"></i> Completed (${lastAttempt.percentage}%)</span>`
          : `<span class="review-status-tag wrong"><i class="fas fa-times-circle"></i> Needs Review (${lastAttempt.percentage}%)</span>`;
      }

      return `
        <div class="test-card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; gap: 0.5rem; flex-wrap: wrap;">
              <span class="test-badge" style="background: ${test.subject_color || 'var(--primary)'}22; color: ${test.subject_color || 'var(--primary)'}; border-color: ${test.subject_color || 'var(--primary)'}44;">
                <i class="fas fa-${test.subject_icon || 'book'}"></i> ${escapeHtml(test.subject_name || 'General')}
              </span>
              ${statusBadge}
            </div>

            <h3 class="test-title" style="margin-bottom: 0.5rem; font-size: 1.15rem;">${escapeHtml(test.title)}</h3>
            <p class="test-desc" style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.45; margin-bottom: 1.25rem;">
              ${escapeHtml(test.description || 'Timed multiple choice assessment with server-side scoring.')}
            </p>
            
            <div class="test-details" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; background: var(--bg-body); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; border: 1px solid var(--border);">
              <div class="test-detail-item" style="text-align: center; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-clock"></i> Duration</span>
                <strong style="font-size: 0.95rem;">${test.duration_minutes} Mins</strong>
              </div>
              <div class="test-detail-item" style="text-align: center; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-question-circle"></i> MCQs</span>
                <strong style="font-size: 0.95rem;">${test.question_count || 0}</strong>
              </div>
              <div class="test-detail-item" style="text-align: center; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-award"></i> Total</span>
                <strong style="font-size: 0.95rem;">${test.total_marks} Marks</strong>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary btn-block" style="flex: 1;" onclick="location.hash='#/instructions/${test.id}'">
              <i class="fas fa-play"></i> ${isAttempted ? 'Retake Test' : 'Start Test'}
            </button>
            ${isAttempted ? `
              <button class="btn btn-secondary" title="View Last Result" onclick="location.hash='#/result/${lastAttempt.attempt_id}'">
                <i class="fas fa-eye"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  handleSearchTests(val) {
    this.searchQuery = val.trim();
    this.renderAllTests();
  },

  handleSubjectFilter(val) {
    this.selectedSubjectFilter = val;
    this.renderAllTests();
  },

  async loadSubjects() {
    const grid = document.getElementById('subjects-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin fa-2x"></i>
        <p style="margin-top: 0.5rem;">Loading available subjects...</p>
      </div>
    `;

    try {
      const data = await API.get('/api/subjects');
      if (!data.subjects || data.subjects.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border);">
            <i class="fas fa-book-open fa-3x" style="color: var(--text-muted); margin-bottom: 1rem;"></i>
            <h3>No Subjects Available</h3>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Please check back later or login as admin to publish subjects.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = data.subjects.map(sub => `
        <div class="subject-card" style="--subject-accent: ${sub.color || '#2563eb'};" onclick="location.hash='#/subject/${sub.id}'">
          <div>
            <div class="subject-icon-box">
              <i class="fas fa-${sub.icon || 'book-open'}"></i>
            </div>
            <h3 class="subject-title">${escapeHtml(sub.name)}</h3>
            <p class="subject-desc">${escapeHtml(sub.description || 'Explore curated tests and assessments for this subject.')}</p>
          </div>
          <div class="subject-meta">
            <span class="meta-badge"><i class="fas fa-file-alt"></i> ${sub.total_tests || 0} Tests</span>
            <span class="meta-badge"><i class="fas fa-question-circle"></i> ${sub.total_questions || 0} MCQs</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--danger);">
          <i class="fas fa-exclamation-triangle fa-2x"></i>
          <p style="margin-top: 0.5rem;">Error loading subjects: ${err.message}</p>
        </div>
      `;
    }
  },

  async selectSubject(subjectId) {
    try {
      const data = await API.get(`/api/subjects/${subjectId}`);
      this.currentSubject = data.subject;

      document.getElementById('subject-tests-title').textContent = data.subject.name;
      document.getElementById('subject-tests-desc').textContent = data.subject.description || 'Select a test below to begin your timed assessment.';

      const grid = document.getElementById('tests-grid');
      if (!data.tests || data.tests.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border);">
            <i class="fas fa-tasks fa-3x" style="color: var(--text-muted); margin-bottom: 1rem;"></i>
            <h3>No Tests in this Subject Yet</h3>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Tests have not been published for this category yet.</p>
          </div>
        `;
      } else {
        grid.innerHTML = data.tests.map(test => `
          <div class="test-card">
            <div>
              <span class="test-badge">${escapeHtml(data.subject.code)}</span>
              <h3 class="test-title">${escapeHtml(test.title)}</h3>
              <p class="test-desc">${escapeHtml(test.description || 'Test your knowledge under timed exam conditions.')}</p>
              
              <div class="test-details">
                <div class="test-detail-item">
                  <i class="fas fa-clock"></i> ${test.duration_minutes} Mins
                </div>
                <div class="test-detail-item">
                  <i class="fas fa-question-circle"></i> ${test.question_count || 0} MCQs
                </div>
                <div class="test-detail-item">
                  <i class="fas fa-award"></i> ${test.total_marks} Marks
                </div>
              </div>
            </div>

            <button class="btn btn-primary btn-block" onclick="location.hash='#/instructions/${test.id}'">
              <i class="fas fa-play"></i> Start Test
            </button>
          </div>
        `).join('');
      }

      App.showView('view-subject-tests');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  async openInstructions(testId) {
    const user = API.getUser();
    if (!user) {
      App.showToast('Please sign in or create an account to start the test.', 'warning');
      App.showAuthModal('login');
      return;
    }

    try {
      const data = await API.get(`/api/tests/${testId}`);
      this.currentTest = data.test;

      document.getElementById('inst-test-title').textContent = data.test.title;
      document.getElementById('inst-subject-name').textContent = data.test.subject_name;
      document.getElementById('inst-duration').textContent = `${data.test.duration_minutes} Mins`;
      document.getElementById('inst-questions-count').textContent = `${data.test.question_count} MCQs`;
      document.getElementById('inst-pass-pct').textContent = `${data.test.passing_percentage}%`;

      const startBtn = document.getElementById('inst-start-btn');
      startBtn.onclick = () => {
        Exam.startTest(testId);
      };

      App.showView('view-test-instructions');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  async loadTestHistory() {
    const tableBody = document.getElementById('history-table-body');
    const emptyState = document.getElementById('history-empty-state');
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="fas fa-spinner fa-spin"></i> Loading test history...
        </td>
      </tr>
    `;

    try {
      const data = await API.get('/api/results/my-history');
      if (!data.results || data.results.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      tableBody.innerHTML = data.results.map(r => {
        const dateStr = new Date(r.submitted_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const isPassed = r.status === 'passed';
        const statusBadge = isPassed
          ? `<span class="review-status-tag correct"><i class="fas fa-check-circle"></i> Passed</span>`
          : `<span class="review-status-tag wrong"><i class="fas fa-times-circle"></i> Needs Review</span>`;

        return `
          <tr>
            <td><strong>${escapeHtml(r.test_title)}</strong></td>
            <td><span class="meta-badge">${escapeHtml(r.subject_name)}</span></td>
            <td><span style="color: var(--text-muted); font-size: 0.85rem;">${dateStr}</span></td>
            <td><strong>${r.score} / ${r.total_marks}</strong></td>
            <td><strong>${r.percentage}%</strong></td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="location.hash='#/result/${r.attempt_id}'">
                <i class="fas fa-eye"></i> View Result
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--danger); padding: 1.5rem;">
            Failed to load history: ${err.message}
          </td>
        </tr>
      `;
    }
  }
};
