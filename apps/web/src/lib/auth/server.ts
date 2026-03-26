import { createNeonAuth } from "@neondatabase/auth/next/server";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required but not set.`);
  }
  return value;
}

// Lazy singleton — deferred so Next.js build doesn't crash when env vars are absent.
let _auth: ReturnType<typeof createNeonAuth> | null = null;

export function getAuth() {
  if (!_auth) {
    _auth = createNeonAuth({
      baseUrl: requiredEnv("NEON_AUTH_BASE_URL"),
      cookies: {
        secret: requiredEnv("NEON_AUTH_COOKIE_SECRET"),
      },
    });
  }
  return _auth;
}

/** @deprecated Use getAuth() instead — kept for backward compatibility */
export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth(), prop, receiver);
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getAuth(), prop, value, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getAuth(), prop);
  },
  ownKeys() {
    return Reflect.ownKeys(getAuth());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getAuth(), prop);
  },
  defineProperty(_target, prop, desc) {
    return Reflect.defineProperty(getAuth(), prop, desc);
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getAuth());
  },
  setPrototypeOf(_target, proto) {
    return Reflect.setPrototypeOf(getAuth(), proto);
  },
});
