// Automatic Result and Performance Breakdown Module
const Result = {
  async showResult(attemptId) {
    App.showView('view-result');

    const container = document.getElementById('result-content');
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin fa-2x"></i>
        <p style="margin-top: 1rem;">Evaluating score & performance...</p>
      </div>
    `;

    try {
      const data = await API.get(`/api/results/attempt/${attemptId}`);
      if (!data.success) {
        throw new Error(data.message);
      }

      const { attempt, questionsBreakdown } = data;
      this.renderResultUI(attempt, questionsBreakdown);
    } catch (err) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--danger); padding: 2rem;">
          <i class="fas fa-exclamation-triangle fa-2x"></i>
          <p style="margin-top: 0.5rem;">Error loading result: ${err.message}</p>
          <button class="btn btn-secondary btn-sm" onclick="location.hash='#/subjects'" style="margin-top: 1rem;">
            <i class="fas fa-arrow-left"></i> Return to Subjects
          </button>
        </div>
      `;
    }
  },

  renderResultUI(attempt, breakdown = []) {
    const container = document.getElementById('result-content');
    const isPassed = attempt.status === 'passed';

    const statusBadgeClass = isPassed ? 'passed' : 'failed';
    const statusText = isPassed ? '<i class="fas fa-check-circle"></i> Passed' : '<i class="fas fa-times-circle"></i> Needs Review';
    const statusColor = isPassed ? 'var(--success)' : 'var(--danger)';

    // Explicit subject ID fallback
    const subjectId = attempt.subject_id || '1';

    const html = `
      <div class="result-card">
        <div class="result-badge ${statusBadgeClass}">
          ${statusText}
        </div>

        <h2 style="font-size: 1.5rem; margin-bottom: 0.25rem;">
          ${escapeHtml(attempt.test_title)}
        </h2>
        <p style="font-size: 0.9rem; margin-bottom: 1.5rem;">
          ${escapeHtml(attempt.subject_name)} • Passing Requirement: ${attempt.passing_percentage}%
        </p>

        <!-- Score Gauge -->
        <div class="score-display-wrapper">
          <div class="score-circle" style="border-color: ${statusColor}">
            <span class="score-number">${attempt.percentage}%</span>
            <span class="score-label">Score</span>
          </div>
        </div>

        <!-- 4 Key Result Stats -->
        <div class="result-stats-grid">
          <div class="result-stat-item total">
            <div class="stat-value">${attempt.total_questions}</div>
            <div class="stat-label">Total Questions</div>
          </div>
          <div class="result-stat-item correct">
            <div class="stat-value">${attempt.correct_answers}</div>
            <div class="stat-label">Correct</div>
          </div>
          <div class="result-stat-item wrong">
            <div class="stat-value">${attempt.wrong_answers}</div>
            <div class="stat-label">Incorrect</div>
          </div>
          <div class="result-stat-item skipped">
            <div class="stat-value">${attempt.unanswered_questions}</div>
            <div class="stat-label">Skipped</div>
          </div>
        </div>

        <div style="background: var(--bg-subtle); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 1.5rem; display: flex; justify-content: space-around; font-size: 0.95rem;">
          <div><strong>Points Scored:</strong> ${attempt.score} / ${attempt.total_marks}</div>
          <div><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 700; text-transform: uppercase;">${attempt.status}</span></div>
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="location.hash='#/subject/${subjectId}'">
            <i class="fas fa-redo"></i> Browse Tests
          </button>
          <button class="btn btn-secondary" onclick="location.hash='#/history'">
            <i class="fas fa-history"></i> My Test History
          </button>
        </div>
      </div>

      <!-- Question-by-Question Detailed Review -->
      <div style="max-width: 720px; margin: 2rem auto 0;">
        <h3 style="font-size: 1.25rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-list-check" style="color: var(--primary);"></i> Question-by-Question Review
        </h3>

        ${breakdown.map((q, idx) => {
          let statusBadge = '';
          if (!q.selected_option) {
            statusBadge = `<span class="review-status-tag skipped"><i class="fas fa-minus-circle"></i> Unanswered</span>`;
          } else if (q.is_correct) {
            statusBadge = `<span class="review-status-tag correct"><i class="fas fa-check-circle"></i> Correct (+${q.marks} mark)</span>`;
          } else {
            statusBadge = `<span class="review-status-tag wrong"><i class="fas fa-times-circle"></i> Incorrect</span>`;
          }

          const optionsList = [
            { key: 'A', text: q.option_a },
            { key: 'B', text: q.option_b },
            { key: 'C', text: q.option_c },
            { key: 'D', text: q.option_d }
          ];

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
                </div>
                ${statusBadge}
              </div>

              <div class="question-text" style="font-size: 1.05rem; margin-bottom: 1rem;">
                ${escapeHtml(q.question_text)}
              </div>

              <div class="review-options">
                ${optionsList.map(opt => {
                  const isCorrect = q.correct_option === opt.key;
                  const isStudentChoice = q.selected_option === opt.key;

                  let optClass = 'review-option';
                  let badge = '';

                  if (isCorrect) {
                    optClass += ' is-correct-answer';
                    badge = `<span style="font-size: 0.75rem; background: var(--success); color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Correct Answer</span>`;
                  }
                  
                  if (isStudentChoice && !isCorrect) {
                    optClass += ' is-student-wrong';
                    badge = `<span style="font-size: 0.75rem; background: var(--danger); color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Your Choice</span>`;
                  } else if (isStudentChoice && isCorrect) {
                    badge = `<span style="font-size: 0.75rem; background: var(--success); color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Your Choice (Correct)</span>`;
                  }

                  return `
                    <div class="${optClass}">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <strong style="width: 20px;">${opt.key}.</strong>
                        <span>${escapeHtml(opt.text)}</span>
                      </div>
                      ${badge}
                    </div>
                  `;
                }).join('')}
              </div>

              ${q.why_answer ? `
                <div class="question-explanation-box">
                  <div class="explanation-title"><i class="fas fa-lightbulb"></i> Why Answer / Explanation:</div>
                  ${escapeHtml(q.why_answer)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.innerHTML = html;
  }
};
