const jwt = require('jsonwebtoken');
const { getAuth, getDb } = require('../config/firebase');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'mcq_secret_key_jwt_super_secure_2026_auth_token';

// Middleware to authenticate any logged in user
async function authenticate(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Please log in to continue.'
    });
  }

  try {
    const auth = getAuth();
    const db = getDb();

    let decoded = null;
    let userId = null;

    // Try Firebase ID Token verification
    try {
      if (auth && typeof auth.verifyIdToken === 'function') {
        const fbUser = await auth.verifyIdToken(token);
        userId = fbUser.uid;
        decoded = {
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email,
          role: fbUser.role || 'student',
          name: fbUser.name || fbUser.displayName || 'User'
        };
      }
    } catch (fbErr) {
      // Fallback: verify as internal signed JWT
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.id || payload.uid;
        decoded = payload;
      } catch (jwtErr) {
        throw new Error('Session expired or invalid token. Please log in again.');
      }
    }

    if (!userId) {
      throw new Error('Invalid token structure.');
    }

    // Refresh role and profile from Firestore user document if available
    try {
      const userDoc = await db.collection('users').doc(String(userId)).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        decoded.role = u.role || decoded.role || 'student';
        decoded.name = u.name || decoded.name;
        decoded.email = u.email || decoded.email;
        decoded.id = userDoc.id;
      }
    } catch (dbErr) {
      // Keep existing decoded info if Firestore query fails
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.message || 'Session expired or invalid token. Please log in again.'
    });
  }
}

// Middleware to require Admin privileges
function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Admin privileges required.'
      });
    }
  });
}

// Generate JWT token (compatible with Firebase Auth sessions)
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user.uid,
      uid: user.id || user.uid,
      name: user.name,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = {
  authenticate,
  requireAdmin,
  generateToken
};
