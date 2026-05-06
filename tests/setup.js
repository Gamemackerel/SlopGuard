// Realistic in-memory storage mock — tests can inspect _store directly.
class MockStorage {
  constructor(initial = {}) {
    this._store = { ...initial };
  }

  async get(keys) {
    if (typeof keys === 'string') return { [keys]: this._store[keys] };
    if (Array.isArray(keys)) {
      const out = {};
      for (const k of keys) out[k] = this._store[k];
      return out;
    }
    return { ...this._store };
  }

  async set(items) {
    Object.assign(this._store, items);
  }

  async remove(keys) {
    const ks = typeof keys === 'string' ? [keys] : keys;
    for (const k of ks) delete this._store[k];
  }

  // Escape hatch for assertions
  _get(key) { return this._store[key]; }
  _clear()   { this._store = {}; }
}

global.MockStorage = MockStorage;

global.chrome = {
  storage: {
    local: {
      get:    jest.fn(async () => ({})),
      set:    jest.fn(async () => {}),
      remove: jest.fn(async () => {}),
    },
    sync: {
      get:    jest.fn(async () => ({})),
      set:    jest.fn(async () => {}),
    },
  },
  action: {
    setIcon:                jest.fn(async () => {}),
    setBadgeText:           jest.fn(async () => {}),
    setBadgeBackgroundColor: jest.fn(async () => {}),
  },
  tabs: {
    query:     jest.fn(async () => []),
    onUpdated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
  },
  runtime: {
    onMessage:      { addListener: jest.fn() },
    sendMessage:    jest.fn(async () => ({})),
    getURL:         jest.fn((p) => `chrome-extension://test/${p}`),
    openOptionsPage: jest.fn(async () => {}),
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});
