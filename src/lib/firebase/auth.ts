"use client";

import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, type Auth } from "firebase/auth";
import { app } from "./config";

// Lazy: only initialize in the browser. Server-side (SSR / build pre-render)
// `getAuth` crashes with empty env vars. All callers run inside useEffect or
// event handlers, so `auth` is never accessed during server rendering.
export const auth = (typeof window !== "undefined" ? getAuth(app) : null) as Auth;

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}
