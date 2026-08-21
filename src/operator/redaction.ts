const SECRET_KEY = /(secret|token|password|private[_-]?key|authorization|service[_-]?role)/i;
const TOKEN_LIKE = /(?:eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}|sk_[a-zA-Z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g;

export function redactSecrets<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(TOKEN_LIKE, '[REDACTED]');
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : walk(child)]));
  return value;
}
