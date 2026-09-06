// Main Application Router, Controller & Theme Manager
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const App = {
  activeView: 'view-home',
  theme: localStorage.getItem('mcq_theme') || 'dark',

  async init() {
    // 1. Initialize Theme
    this.applyTheme(this.theme);

    // 2. Setup Navigation & View routing
    this.setupEventListeners();

    // 3. Verify Existing Session
    const user = await Auth.verifySession();
    this.updateNavigation();

    // 4. Check for ongoing test attempt
    if (user && user.role !== 'admin') {
      this.checkActiveAttempt();
    }

    // 5. Handle initial URL hash route
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();

    // 6. Listen to session expiration
    window.addEventListener('auth:expired', () => {
      this.showToast('Your session has expired. Please sign in again.', 'warning');
      this.updateNavigation();
      this.showAuthModal('login');
    });
  },

  handleRoute() {
    const hash = window.location.hash || '#/home';
    const parts = hash.split('/');
    const root = parts[1] || 'home';
    const param = parts[2] || null;

    const user = API.getUser();

    switch (root) {
      case 'home':
        this.showView('view-home');
        break;
      case 'subjects':
        this.showView('view-student-subjects');
        Student.loadSubjects();
        break;
      case 'subject':
        if (param) {
          Student.selectSubject(param);
        } else {
          location.hash = '#/subjects';
        }
        break;
      case 'instructions':
        if (param) {
          Student.openInstructions(param);
        } else {
          location.hash = '#/subjects';
        }
        break;
      case 'exam':
        if (Exam.attemptId) {
          this.showView('view-exam');
        } else {
          this.checkActiveAttempt(true);
        }
        break;
      case 'result':
        if (param) {
          Result.showResult(param);
        } else {
          location.hash = '#/history';
        }
        break;
      case 'history':
        if (!user) {
          this.showAuthModal('login');
          location.hash = '#/home';
        } else {
          this.showView('view-student-history');
          Student.loadTestHistory();
        }
        break;
      case 'admin':
        if (!user || user.role !== 'admin') {
          this.showToast('Admin privileges required to access the admin portal.', 'danger');
          this.showAuthModal('login');
          location.hash = '#/home';
        } else {
          this.showView('view-admin');
          Admin.init();
        }
        break;
      default:
        this.showView('view-home');
        break;
    }
  },

  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mcq_theme', theme);

    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
  },

  toggleTheme() {
    const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  },

  handleGetStarted() {
    location.hash = '#/subjects';
  },

  async checkActiveAttempt(autoResumeIfOnExamRoute = false) {
    const user = API.getUser();
    if (!user || user.role === 'admin') return;

    try {
      const data = await API.get('/api/exam/active-attempt');
      const banner = document.getElementById('active-attempt-banner');
      const testName = document.getElementById('active-banner-test-name');

      if (data.success && data.hasActiveAttempt) {
        if (banner) banner.style.display = 'flex';
        if (testName) testName.textContent = data.test.title;

        if (autoResumeIfOnExamRoute) {
          Exam.resumeActiveTest();
        }
      } else {
        if (banner) banner.style.display = 'none';
        if (autoResumeIfOnExamRoute) {
          location.hash = '#/subjects';
        }
      }
    } catch (e) {
      // Ignore
    }
  },

  hideActiveAttemptBanner() {
    const banner = document.getElementById('active-attempt-banner');
    if (banner) banner.style.display = 'none';
  },

  setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

    // Navigation links
    document.querySelectorAll('[data-target-view]').forEach(el => {
      el.addEventListener('click', (e) => {
        const target = el.getAttribute('data-target-view');
        if (target === 'view-home') location.hash = '#/home';
        if (target === 'view-student-subjects') location.hash = '#/subjects';
        if (target === 'view-student-history') location.hash = '#/history';
        if (target === 'view-admin') location.hash = '#/admin';
      });
    });

    // Close modals on clicking outside or close buttons
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('active');
        }
      });
    });

    // Handle Auth Forms
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      const ok = await Auth.login(email, pass);
      if (ok) this.closeModal('modal-auth');
    });

    document.getElementById('form-signup')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value;
      const email = document.getElementById('signup-email').value;
      const pass = document.getElementById('signup-password').value;
      const ok = await Auth.signup(name, email, pass);
      if (ok) this.closeModal('modal-auth');
    });

    document.getElementById('form-forgot-password')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value;
      await Auth.forgotPassword(email);
    });

    // Admin Forms
    document.getElementById('form-subject')?.addEventListener('submit', (e) => Admin.saveSubject(e));
    document.getElementById('form-test')?.addEventListener('submit', (e) => Admin.saveTest(e));
    document.getElementById('form-question')?.addEventListener('submit', (e) => Admin.saveQuestion(e));

    // Exam Controls
    document.getElementById('exam-prev-btn')?.addEventListener('click', () => Exam.prevQuestion());
    document.getElementById('exam-next-btn')?.addEventListener('click', () => Exam.nextQuestion());
    document.getElementById('modal-btn-confirm-submit')?.addEventListener('click', () => Exam.submitTest(false));
  },

  showView(viewId) {
    this.activeView = viewId;

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSection = document.getElementById(viewId);
    if (targetSection) {
      targetSection.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.nav-link').forEach(link => {
      const target = link.getAttribute('data-target-view');
      link.classList.toggle('active', target === viewId);
    });
  },

  updateNavigation() {
    const user = API.getUser();
    const guestActions = document.getElementById('nav-guest-actions');
    const userActions = document.getElementById('nav-user-actions');
    const userDisplay = document.getElementById('nav-user-display');
    const studentLinks = document.getElementById('nav-student-links');
    const adminLinks = document.getElementById('nav-admin-links');

    if (user) {
      if (guestActions) guestActions.style.display = 'none';
      if (userActions) userActions.style.display = 'flex';
      if (userDisplay) {
        userDisplay.innerHTML = `
          <i class="fas ${user.role === 'admin' ? 'fa-shield-halved' : 'fa-user-graduate'}"></i>
          <span>${escapeHtml(user.name)}</span>
          <small style="opacity: 0.8; font-size: 0.75rem;">(${user.role.toUpperCase()})</small>
        `;
      }

      if (user.role === 'admin') {
        if (studentLinks) studentLinks.style.display = 'none';
        if (adminLinks) adminLinks.style.display = 'flex';
      } else {
        if (studentLinks) studentLinks.style.display = 'flex';
        if (adminLinks) adminLinks.style.display = 'none';
      }
    } else {
      if (guestActions) guestActions.style.display = 'flex';
      if (userActions) userActions.style.display = 'none';
      if (studentLinks) studentLinks.style.display = 'none';
      if (adminLinks) adminLinks.style.display = 'none';
    }
  },

  showAuthModal(mode = 'login') {
    this.setAuthMode(mode);
    this.openModal('modal-auth');
  },

  showForgotPasswordModal() {
    this.closeModal('modal-auth');
    this.openModal('modal-forgot-password');
  },

  setAuthMode(mode) {
    const loginTab = document.getElementById('tab-auth-login');
    const signupTab = document.getElementById('tab-auth-signup');
    const loginForm = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');
    const modalTitle = document.getElementById('auth-modal-title');

    if (mode === 'login') {
      loginTab?.classList.add('active');
      signupTab?.classList.remove('active');
      if (loginForm) loginForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
      if (modalTitle) modalTitle.textContent = 'Sign In';
    } else {
      signupTab?.classList.add('active');
      loginTab?.classList.remove('active');
      if (loginForm) loginForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'block';
      if (modalTitle) modalTitle.textContent = 'Create Student Account';
    }
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'danger') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    toast.innerHTML = `
      <i class="fas fa-${icon}"></i>
      <div style="flex: 1;">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

// Initialize App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
