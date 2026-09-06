// Student Features Module
const Student = {
  currentSubject: null,
  currentTest: null,

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
