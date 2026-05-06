// Thin wrappers around chrome.storage so modules can be tested via
// dependency injection — tests pass a MockStorage instead of these.

export const localStore = {
  get:    (keys)  => chrome.storage.local.get(keys),
  set:    (items) => chrome.storage.local.set(items),
  remove: (keys)  => chrome.storage.local.remove(keys),
};
