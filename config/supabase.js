const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

let supabaseClient = null;
let isLive = false;

// 1. Initialize Supabase Client with fast health check
function initSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          fetch: (...args) => {
            // Set 3000ms max timeout on Supabase fetch calls to avoid long freezes
            return fetch(args[0], { ...args[1], signal: AbortSignal.timeout(3000) });
          }
        }
      });
      isLive = true;
      console.log(`⚡ Supabase Cloud Database configured: ${supabaseUrl}`);

      // Fast async ping check
      supabaseClient.from('tests').select('id').limit(1).then(({ error }) => {
        if (error) {
          console.warn('⚠️ Supabase ping failed, switching to local store:', error.message);
          isLive = false;
        } else {
          isLive = true;
          console.log('✅ Supabase Cloud Database ping verified active.');
        }
      }).catch(err => {
        console.warn('⚠️ Supabase ping connection timeout, switching to local store:', err.message);
        isLive = false;
      });

      return { client: supabaseClient, isLive: true };
    } catch (err) {
      console.warn('⚠️ Supabase connection initialization warning:', err.message);
    }
  }

  console.log('ℹ️ Supabase credentials not active. Using high-performance Pure-JS Local Store.');
  isLive = false;
  return { client: null, isLive: false };
}

initSupabase();

/**
 * High-performance Pure-JS local storage layer for development fallback.
 * (Zero native C++ modules, 100% serverless safe, no sqlite3 dependencies)
 */
const isVercel = Boolean(process.env.VERCEL);
const projectDataDir = path.resolve(__dirname, '..', 'data');
const fallbackDataDir = path.join(os.tmpdir(), 'mcq_local_store');

function resolveLocalDataDir() {
  const preferred = process.env.LOCAL_DATA_PATH || projectDataDir;

  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    return preferred;
  } catch (e) {
    try {
      if (!fs.existsSync(fallbackDataDir)) {
        fs.mkdirSync(fallbackDataDir, { recursive: true });
      }
      return fallbackDataDir;
    } catch (fallbackErr) {
      return fallbackDataDir;
    }
  }
}

const localDataDir = resolveLocalDataDir();
let persistenceDisabled = false;
try {
  if (!fs.existsSync(localDataDir)) {
    fs.mkdirSync(localDataDir, { recursive: true });
  }
} catch (e) {
  persistenceDisabled = true;
}

const localStorePath = path.join(localDataDir, 'mcq_supabase_cache.json');
const legacyStorePath = path.join(projectDataDir, 'firestore_local_store.json');
let memoryStore = {};

if (!persistenceDisabled) {
  if (fs.existsSync(localStorePath)) {
    try {
      memoryStore = JSON.parse(fs.readFileSync(localStorePath, 'utf8'));
    } catch (e) {
      memoryStore = {};
    }
  } else if (fs.existsSync(legacyStorePath)) {
    try {
      memoryStore = JSON.parse(fs.readFileSync(legacyStorePath, 'utf8'));
    } catch (e) {
      memoryStore = {};
    }
  }
}

function saveMemoryStore() {
  if (persistenceDisabled) return;
  try {
    fs.writeFileSync(localStorePath, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (e) {
    // Ignore temp file write error on restricted serverless runtimes
  }
}

// Universal Query Builder & Document Reference for Supabase + Local Fallback
class SupabaseDocRef {
  constructor(tableName, docId) {
    this.table = tableName;
    this.id = String(docId);
  }

  async get() {
    if (isLive && supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from(this.table)
          .select('*')
          .eq('id', this.id)
          .maybeSingle();

        if (error) throw error;
        return {
          exists: !!data,
          id: this.id,
          data: () => (data ? { ...data } : undefined)
        };
      } catch (err) {
        console.warn(`Supabase get error on ${this.table}/${this.id}:`, err.message);
        isLive = false; // Fallback to local store
      }
    }

    // Local Fallback
    const col = memoryStore[this.table] || {};
    const data = col[this.id];
    return {
      exists: !!data,
      id: this.id,
      data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
    };
  }

  async set(data, options = {}) {
    const payload = { ...data, id: this.id };
    if (isLive && supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from(this.table)
          .upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        return { writeTime: new Date() };
      } catch (err) {
        console.warn(`Supabase set error on ${this.table}/${this.id}:`, err.message);
        isLive = false;
      }
    }

    // Local Fallback
    if (!memoryStore[this.table]) memoryStore[this.table] = {};
    const existing = memoryStore[this.table][this.id] || {};
    memoryStore[this.table][this.id] = options.merge ? { ...existing, ...payload } : payload;
    saveMemoryStore();
    return { writeTime: new Date() };
  }

  async update(data) {
    if (isLive && supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from(this.table)
          .update(data)
          .eq('id', this.id);
        if (error) throw error;
        return { writeTime: new Date() };
      } catch (err) {
        console.warn(`Supabase update error on ${this.table}/${this.id}:`, err.message);
        isLive = false;
      }
    }

    // Local Fallback
    if (!memoryStore[this.table] || !memoryStore[this.table][this.id]) {
      throw new Error(`Document ${this.table}/${this.id} not found`);
    }
    memoryStore[this.table][this.id] = { ...memoryStore[this.table][this.id], ...data };
    saveMemoryStore();
    return { writeTime: new Date() };
  }

  async delete() {
    if (isLive && supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from(this.table)
          .delete()
          .eq('id', this.id);
        if (error) throw error;
        return { writeTime: new Date() };
      } catch (err) {
        console.warn(`Supabase delete error on ${this.table}/${this.id}:`, err.message);
        isLive = false;
      }
    }

    // Local Fallback
    if (memoryStore[this.table] && memoryStore[this.table][this.id]) {
      delete memoryStore[this.table][this.id];
      saveMemoryStore();
    }
    return { writeTime: new Date() };
  }
}

class SupabaseQuery {
  constructor(tableName, filters = [], orderBys = [], limitCount = null) {
    this.table = tableName;
    this.filters = filters;
    this.orderBys = orderBys;
    this.limitCount = limitCount;
  }

  where(field, op, value) {
    return new SupabaseQuery(
      this.table,
      [...this.filters, { field, op, value }],
      this.orderBys,
      this.limitCount
    );
  }

  orderBy(field, direction = 'asc') {
    return new SupabaseQuery(
      this.table,
      this.filters,
      [...this.orderBys, { field, direction: direction.toLowerCase() }],
      this.limitCount
    );
  }

  limit(n) {
    return new SupabaseQuery(this.table, this.filters, this.orderBys, n);
  }

  async get() {
    if (isLive && supabaseClient) {
      try {
        let q = supabaseClient.from(this.table).select('*');

        for (const f of this.filters) {
          if (f.op === '==' || f.op === '===') {
            q = q.eq(f.field, f.value);
          } else if (f.op === '!=') {
            q = q.neq(f.field, f.value);
          } else if (f.op === '>') {
            q = q.gt(f.field, f.value);
          } else if (f.op === '>=') {
            q = q.gte(f.field, f.value);
          } else if (f.op === '<') {
            q = q.lt(f.field, f.value);
          } else if (f.op === '<=') {
            q = q.lte(f.field, f.value);
          } else if (f.op === 'in' && Array.isArray(f.value)) {
            q = q.in(f.field, f.value);
          }
        }

        for (const ord of this.orderBys) {
          q = q.order(ord.field, { ascending: ord.direction === 'asc' });
        }

        if (this.limitCount !== null) {
          q = q.limit(this.limitCount);
        }

        const { data, error } = await q;
        if (error) throw error;

        const rows = data || [];
        if (rows.length > 0 || !memoryStore[this.table] || Object.keys(memoryStore[this.table]).length === 0) {
          return {
            empty: rows.length === 0,
            size: rows.length,
            docs: rows.map(r => ({
              id: String(r.id),
              exists: true,
              data: () => ({ ...r })
            }))
          };
        }
      } catch (err) {
        console.warn(`Supabase query get error on ${this.table}:`, err.message);
        isLive = false;
      }
    }

    // Local Memory Store Fallback
    const col = memoryStore[this.table] || {};
    let docs = Object.keys(col).map(id => ({
      id,
      ...col[id]
    }));

    for (const f of this.filters) {
      docs = docs.filter(d => {
        const val = d[f.field];
        if (f.op === '==' || f.op === '===') return String(val) === String(f.value);
        if (f.op === '!=') return String(val) !== String(f.value);
        if (f.op === '>') return val > f.value;
        if (f.op === '>=') return val >= f.value;
        if (f.op === '<') return val < f.value;
        if (f.op === '<=') return val <= f.value;
        if (f.op === 'in') return Array.isArray(f.value) && f.value.map(String).includes(String(val));
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
        id: String(d.id),
        exists: true,
        data: () => {
          const raw = col[d.id];
          return raw ? JSON.parse(JSON.stringify(raw)) : {};
        }
      }))
    };
  }
}

class SupabaseTableRef extends SupabaseQuery {
  constructor(tableName) {
    super(tableName);
  }

  doc(id) {
    const docId = id || 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    return new SupabaseDocRef(this.table, String(docId));
  }

  async add(data) {
    const id = data.id || 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const docRef = this.doc(id);
    await docRef.set(data);
    return docRef;
  }

  async bulkAdd(items) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const now = Date.now();
    const docs = items.map((data, index) => {
      const id = data.id || `doc_${now}_${index}_` + Math.random().toString(36).substring(2, 7);
      return { ...data, id };
    });

    if (isLive && supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from(this.table)
          .upsert(docs, { onConflict: 'id' });
        if (error) throw error;
        return docs.map(d => this.doc(d.id));
      } catch (err) {
        console.warn(`Supabase bulkAdd error on ${this.table}:`, err.message);
        isLive = false;
      }
    }

    // Local Memory Store Fallback
    if (!memoryStore[this.table]) memoryStore[this.table] = {};
    for (const d of docs) {
      memoryStore[this.table][d.id] = d;
    }
    saveMemoryStore();
    return docs.map(d => this.doc(d.id));
  }
}

const db = {
  collection(name) {
    return new SupabaseTableRef(name);
  }
};

module.exports = {
  db,
  getDb: () => db,
  getSupabaseClient: () => supabaseClient,
  isLiveSupabase: () => isLive,
  initSupabase
};
