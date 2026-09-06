// Timed MCQ Test Engine with Progress Preservation & Keyboard Navigation
const Exam = {
  attemptId: null,
  test: null,
  questions: [],
  currentIndex: 0,
  answers: {}, // { [questionId]: 'A' | 'B' | 'C' | 'D' }
  timerInterval: null,
  autoSaveInterval: null,
  remainingSeconds: 0,
  isSubmitting: false,

  async startTest(testId) {
    try {
      App.showToast('Preparing your test...', 'info');
      const data = await API.get(`/api/exam/start/${testId}`);

      if (!data.success) {
        throw new Error(data.message);
      }

      this.initializeExamSession(data);
      App.showToast('Test started! Best of luck.', 'success');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  async resumeActiveTest() {
    try {
      App.showToast('Resuming your active test attempt...', 'info');
      const data = await API.get('/api/exam/active-attempt');

      if (!data.success || !data.hasActiveAttempt) {
        App.showToast('No active attempt found.', 'warning');
        return;
      }

      this.initializeExamSession(data);
      App.showToast('Active test resumed.', 'info');
    } catch (err) {
      App.showToast(err.message, 'danger');
    }
  },

  initializeExamSession(data) {
    this.attemptId = data.attemptId;
    this.test = data.test;
    this.questions = data.questions || [];
    this.currentIndex = data.currentIndex || 0;
    this.answers = data.savedAnswers || {};
    this.isSubmitting = false;
    this.remainingSeconds = data.remainingSeconds !== undefined ? data.remainingSeconds : (this.test.duration_minutes || 10) * 60;

    // Update Header
    document.getElementById('exam-test-title').textContent = this.test.title;
    document.getElementById('exam-test-meta').textContent = `${this.test.subject_name || 'Subject'} • ${this.questions.length} Questions • ${this.test.duration_minutes} Mins`;

    // Render components
    this.renderPalette();
    this.renderCurrentQuestion();
    this.startTimer();
    this.startAutoSave();
    this.attachKeyboardShortcuts();

    // Show View
    App.showView('view-exam');
    location.hash = '#/exam';
  },

  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    const timerElement = document.getElementById('exam-timer-display');
    const timerBox = document.getElementById('exam-timer-box');

    const updateDisplay = () => {
      const minutes = Math.floor(this.remainingSeconds / 60);
      const seconds = this.remainingSeconds % 60;
      const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      if (timerElement) timerElement.textContent = formatted;

      if (timerBox) {
        if (this.remainingSeconds <= 60) {
          timerBox.className = 'timer-box timer-danger';
        } else if (this.remainingSeconds <= 180) {
          timerBox.className = 'timer-box timer-warning';
        } else {
          timerBox.className = 'timer-box';
        }
      }

      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        App.showToast('⏰ Time is up! Submitting your answers automatically...', 'warning');
        this.submitTest(true);
      } else {
        this.remainingSeconds--;
      }
    };

    updateDisplay();
    this.timerInterval = setInterval(updateDisplay, 1000);
  },

  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    // Auto-save answers every 15 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveProgress();
    }, 15000);
  },

  async saveProgress() {
    if (!this.attemptId || this.isSubmitting) return;

    try {
      await API.post('/api/exam/save-progress', {
        attemptId: this.attemptId,
        answers: this.answers,
        remainingSeconds: this.remainingSeconds,
        currentIndex: this.currentIndex
      });
    } catch (e) {
      // Background save failure ignored
    }
  },

  renderCurrentQuestion() {
    if (!this.questions || this.questions.length === 0) return;

    const q = this.questions[this.currentIndex];
    const total = this.questions.length;

    // Progress Bar & Label
    const progressPct = ((this.currentIndex + 1) / total) * 100;
    document.getElementById('question-progress-bar').style.width = `${progressPct}%`;
    document.getElementById('question-progress-label').textContent = `Question ${this.currentIndex + 1} of ${total}`;
    document.getElementById('question-marks-badge').textContent = `Marks: ${q.marks || 1}`;

    // Question Text
    document.getElementById('current-question-text').textContent = q.question_text;

    // Render 4 Options
    const optionsContainer = document.getElementById('question-options-container');
    const selectedAnswer = this.answers[q.id];

    const options = [
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d }
    ];

    optionsContainer.innerHTML = options.map(opt => {
      const isSelected = selectedAnswer === opt.key;
      return `
        <div class="option-card ${isSelected ? 'selected' : ''}" onclick="Exam.selectOption('${q.id}', '${opt.key}')" role="button" tabindex="0" aria-pressed="${isSelected}">
          <div class="option-letter">${opt.key}</div>
          <div class="option-text">${escapeHtml(opt.text)}</div>
        </div>
      `;
    }).join('');

    // Previous & Next Buttons
    const prevBtn = document.getElementById('exam-prev-btn');
    const nextBtn = document.getElementById('exam-next-btn');

    if (prevBtn) prevBtn.disabled = this.currentIndex === 0;

    if (nextBtn) {
      if (this.currentIndex === total - 1) {
        nextBtn.innerHTML = '<i class="fas fa-clipboard-check"></i> Review & Submit';
        nextBtn.className = 'btn btn-success';
      } else {
        nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
        nextBtn.className = 'btn btn-primary';
      }
    }

    this.updatePaletteHighlight();
  },

  selectOption(questionId, optionKey) {
    if (this.isSubmitting) return;

    if (this.answers[questionId] === optionKey) {
      delete this.answers[questionId];
    } else {
      this.answers[questionId] = optionKey;
    }

    this.renderCurrentQuestion();
    this.renderPalette();
    this.saveProgress();
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCurrentQuestion();
      this.saveProgress();
    }
  },

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.renderCurrentQuestion();
      this.saveProgress();
    } else {
      this.openSubmitModal();
    }
  },

  goToQuestion(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentIndex = index;
      this.renderCurrentQuestion();
      this.saveProgress();
    }
  },

  renderPalette() {
    const grid = document.getElementById('question-palette-grid');
    if (!grid) return;

    grid.innerHTML = this.questions.map((q, idx) => {
      const isAnswered = Boolean(this.answers[q.id]);
      const isCurrent = idx === this.currentIndex;
      let classes = 'palette-btn';

      if (isAnswered) classes += ' answered';
      if (isCurrent) classes += ' current';

      return `
        <button class="${classes}" onclick="Exam.goToQuestion(${idx})" title="Question ${idx + 1}" type="button">
          ${idx + 1}
        </button>
      `;
    }).join('');
  },

  updatePaletteHighlight() {
    const btns = document.querySelectorAll('.palette-btn');
    btns.forEach((b, idx) => {
      if (idx === this.currentIndex) {
        b.classList.add('current');
      } else {
        b.classList.remove('current');
      }
    });
  },

  attachKeyboardShortcuts() {
    document.onkeydown = (e) => {
      if (App.activeView !== 'view-exam' || this.isSubmitting) return;

      const key = e.key.toUpperCase();
      const currentQ = this.questions[this.currentIndex];
      if (!currentQ) return;

      if (['A', 'B', 'C', 'D'].includes(key)) {
        this.selectOption(currentQ.id, key);
      } else if (key === '1') {
        this.selectOption(currentQ.id, 'A');
      } else if (key === '2') {
        this.selectOption(currentQ.id, 'B');
      } else if (key === '3') {
        this.selectOption(currentQ.id, 'C');
      } else if (key === '4') {
        this.selectOption(currentQ.id, 'D');
      } else if (e.key === 'ArrowRight') {
        this.nextQuestion();
      } else if (e.key === 'ArrowLeft') {
        this.prevQuestion();
      }
    };
  },

  openSubmitModal() {
    const total = this.questions.length;
    const answered = Object.keys(this.answers).length;
    const unanswered = total - answered;

    document.getElementById('modal-submit-total').textContent = total;
    document.getElementById('modal-submit-answered').textContent = answered;
    document.getElementById('modal-submit-unanswered').textContent = unanswered;

    App.openModal('modal-confirm-submit');
  },

  async submitTest(isAuto = false) {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    document.onkeydown = null;

    App.closeModal('modal-confirm-submit');
    App.showToast(isAuto ? 'Auto-submitting test...' : 'Submitting test answers...', 'info');

    try {
      const payload = {
        attemptId: this.attemptId,
        testId: this.test.id,
        answers: this.answers
      };

      const data = await API.post('/api/exam/submit', payload);

      if (!data.success) {
        throw new Error(data.message);
      }

      App.showToast('Test submitted successfully!', 'success');
      App.hideActiveAttemptBanner();

      // Navigate to detailed result
      location.hash = `#/result/${data.attemptId}`;
    } catch (err) {
      this.isSubmitting = false;
      App.showToast('Submission error: ' + err.message, 'danger');
    }
  }
};
