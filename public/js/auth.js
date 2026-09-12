// Authentication Module
const Auth = {
  async signup(name, email, password) {
    try {
      const data = await API.post('/api/auth/signup', { name, email, password });
      API.setToken(data.token);
      API.setUser(data.user);
      App.showToast(`Account created successfully! Welcome, ${data.user.name}.`, 'success');
      App.updateNavigation();
      location.hash = '#/tests';
      return true;
    } catch (err) {
      App.showToast(err.message, 'danger');
      return false;
    }
  },

  async login(email, password) {
    try {
      const data = await API.post('/api/auth/login', { email, password });
      API.setToken(data.token);
      API.setUser(data.user);
      App.showToast(`Welcome back, ${data.user.name}!`, 'success');
      App.updateNavigation();

      if (data.user.role === 'admin') {
        location.hash = '#/admin';
      } else {
        // Check for active attempt
        App.checkActiveAttempt();
        location.hash = '#/tests';
      }
      return true;
    } catch (err) {
      App.showToast(err.message, 'danger');
      return false;
    }
  },

  async forgotPassword(email) {
    try {
      const data = await API.post('/api/auth/forgot-password', { email });
      App.showToast(data.message, 'info');
      App.closeModal('modal-forgot-password');
      return true;
    } catch (err) {
      App.showToast(err.message, 'danger');
      return false;
    }
  },

  async logout() {
    try {
      await API.post('/api/auth/logout', {});
    } catch (e) {
      // Ignore network failure on logout
    }
    API.clearSession();
    App.showToast('You have been logged out.', 'info');
    App.updateNavigation();
    location.hash = '#/home';
  },

  async verifySession() {
    const token = API.getToken();
    if (!token) return null;

    try {
      const data = await API.get('/api/auth/me');
      if (data.success && data.user) {
        API.setUser(data.user);
        return data.user;
      }
    } catch (err) {
      API.clearSession();
    }
    return null;
  }
};
