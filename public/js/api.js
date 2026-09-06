// API Helper for Backend & Firebase Communications
const API = {
  getToken() {
    return localStorage.getItem('mcq_auth_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('mcq_auth_token', token);
    } else {
      localStorage.removeItem('mcq_auth_token');
    }
  },

  getUser() {
    try {
      const u = localStorage.getItem('mcq_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('mcq_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mcq_user');
    }
  },

  clearSession() {
    localStorage.removeItem('mcq_auth_token');
    localStorage.removeItem('mcq_user');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.clearSession();
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new Error(data.message || 'An error occurred while processing the request.');
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
