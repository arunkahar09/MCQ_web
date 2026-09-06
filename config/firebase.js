const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let db = null;
let auth = null;
let isLiveFirebase = false;

function initFirebase() {
  if (admin.apps && admin.apps.length > 0) {
    isLiveFirebase = true;
    db = admin.firestore();
    auth = admin.auth();
    return { admin, db, auth, isLiveFirebase };
  }

  // 1. Check for Service Account JSON in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const serviceAccount = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
      });
      isLiveFirebase = true;
      db = admin.firestore();
      auth = admin.auth();
      console.log(`🔥 Initialized Firebase Admin SDK with Service Account for project: ${serviceAccount.project_id}`);
      return { admin, db, auth, isLiveFirebase };
    } catch (err) {
      console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:', err.message);
    }
  }

  // 2. Check for Service Account Key File Path
  const credPath = process.env.FIREBASE_CREDENTIALS_PATH || path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(credPath)) {
    try {
      const serviceAccount = require(path.resolve(credPath));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
      });
      isLiveFirebase = true;
      db = admin.firestore();
      auth = admin.auth();
      console.log(`🔥 Initialized Firebase Admin SDK from file '${credPath}' (Project: ${serviceAccount.project_id})`);
      return { admin, db, auth, isLiveFirebase };
    } catch (err) {
      console.warn(`⚠️ Could not load credentials from ${credPath}:`, err.message);
    }
  }

  // 3. Check for Project ID with default app credential / emulator
  if (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'mcq-test-portal-demo'
      });
      isLiveFirebase = true;
      db = admin.firestore();
      auth = admin.auth();
      console.log(`🔥 Initialized Firebase Admin SDK for Project: ${process.env.FIREBASE_PROJECT_ID || 'mcq-test-portal-demo'}`);
      return { admin, db, auth, isLiveFirebase };
    } catch (err) {
      console.warn('⚠️ Could not initialize default Firebase Admin:', err.message);
    }
  }

  console.log('ℹ️ Firebase Live Credentials not detected. Using high-performance Local Firestore Service layer.');
  return createLocalFirestoreService();
}

/**
 * High-performance local Firestore-compatible service layer for local development / testing
 */
function createLocalFirestoreService() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const storePath = path.join(dataDir, 'firestore_local_store.json');

  let store = {};
  if (fs.existsSync(storePath)) {
    try {
      store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (e) {
      store = {};
    }
  }

  function saveStore() {
    try {
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving local firestore store:', e);
    }
  }

  class LocalDocumentReference {
    constructor(collectionName, docId) {
      this.collectionName = collectionName;
      this.id = docId;
    }

    async get() {
      const col = store[this.collectionName] || {};
      const data = col[this.id];
      return {
        exists: !!data,
        id: this.id,
        data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
      };
    }

    async set(data, options = {}) {
      if (!store[this.collectionName]) store[this.collectionName] = {};
      const existing = store[this.collectionName][this.id] || {};
      const toSave = options.merge ? { ...existing, ...data } : { ...data };
      store[this.collectionName][this.id] = toSave;
      saveStore();
      return { writeTime: new Date() };
    }

    async update(data) {
      if (!store[this.collectionName] || !store[this.collectionName][this.id]) {
        throw new Error(`Document ${this.collectionName}/${this.id} not found`);
      }
      store[this.collectionName][this.id] = {
        ...store[this.collectionName][this.id],
        ...data
      };
      saveStore();
      return { writeTime: new Date() };
    }

    async delete() {
      if (store[this.collectionName] && store[this.collectionName][this.id]) {
        delete store[this.collectionName][this.id];
        saveStore();
      }
      return { writeTime: new Date() };
    }
  }

  class LocalQuery {
    constructor(collectionName, filters = [], orderBys = [], limitCount = null) {
      this.collectionName = collectionName;
      this.filters = filters;
      this.orderBys = orderBys;
      this.limitCount = limitCount;
    }

    where(field, op, value) {
      return new LocalQuery(
        this.collectionName,
        [...this.filters, { field, op, value }],
        this.orderBys,
        this.limitCount
      );
    }

    orderBy(field, direction = 'asc') {
      return new LocalQuery(
        this.collectionName,
        this.filters,
        [...this.orderBys, { field, direction: direction.toLowerCase() }],
        this.limitCount
      );
    }

    limit(n) {
      return new LocalQuery(this.collectionName, this.filters, this.orderBys, n);
    }

    async get() {
      const col = store[this.collectionName] || {};
      let docs = Object.keys(col).map(id => ({
        id,
        data: () => JSON.parse(JSON.stringify(col[id])),
        ...col[id]
      }));

      for (const f of this.filters) {
        docs = docs.filter(d => {
          const val = d[f.field];
          if (f.op === '==' || f.op === '===') return val === f.value;
          if (f.op === '!=') return val !== f.value;
          if (f.op === '>') return val > f.value;
          if (f.op === '>=') return val >= f.value;
          if (f.op === '<') return val < f.value;
          if (f.op === '<=') return val <= f.value;
          if (f.op === 'in') return Array.isArray(f.value) && f.value.includes(val);
          return true;
        });
      }

      for (const ord of this.orderBys) {
        docs.sort((a, b) => {
          const valA = a[ord.field];
          const valB = b[ord.field];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          const res = valA > valB ? 1 : -1;
          return ord.direction === 'desc' ? -res : res;
        });
      }

      if (this.limitCount !== null) {
        docs = docs.slice(0, this.limitCount);
      }

      return {
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.map(d => ({
          id: d.id,
          exists: true,
          data: () => {
            const raw = col[d.id];
            return raw ? JSON.parse(JSON.stringify(raw)) : {};
          }
        }))
      };
    }
  }

  class LocalCollectionReference extends LocalQuery {
    constructor(collectionName) {
      super(collectionName);
    }

    doc(id) {
      const docId = id || 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      return new LocalDocumentReference(this.collectionName, String(docId));
    }

    async add(data) {
      const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const docRef = this.doc(id);
      await docRef.set(data);
      return docRef;
    }
  }

  const localDb = {
    collection(name) {
      return new LocalCollectionReference(name);
    }
  };

  const localAuth = {
    async verifyIdToken(token) {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'mcq_secret_key_jwt_super_secure_2026_auth_token';
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { uid: decoded.id || decoded.uid, email: decoded.email, role: decoded.role, name: decoded.name };
      } catch (e) {
        const userDoc = await localDb.collection('users').doc(token).get();
        if (userDoc.exists) {
          const u = userDoc.data();
          return { uid: token, email: u.email, role: u.role, name: u.name };
        }
        throw new Error('Invalid or expired Firebase ID token');
      }
    },
    async createUser(userData) {
      const uid = userData.uid || 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      return { uid, email: userData.email, displayName: userData.displayName };
    },
    async getUserByEmail(email) {
      const snap = await localDb.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
      if (snap.empty) {
        const err = new Error('No user record found for given email');
        err.code = 'auth/user-not-found';
        throw err;
      }
      const u = snap.docs[0].data();
      return { uid: snap.docs[0].id, email: u.email, displayName: u.name };
    }
  };

  db = localDb;
  auth = localAuth;
  isLiveFirebase = false;

  return { admin: null, db, auth, isLiveFirebase };
}

const firebaseInstance = initFirebase();

module.exports = {
  admin: firebaseInstance.admin,
  db: firebaseInstance.db,
  auth: firebaseInstance.auth,
  isLiveFirebase: () => isLiveFirebase,
  getDb: () => db,
  getAuth: () => auth,
  initFirebase
};
