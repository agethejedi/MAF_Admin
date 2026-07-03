// js/firebase-config.js — Same Firebase project as main app
// Cloudflare Pages injects these at build time

export const firebaseConfig = {
  apiKey:            "__FIREBASE_API_KEY__",
  authDomain:        "__FIREBASE_AUTH_DOMAIN__",
  projectId:         "__FIREBASE_PROJECT_ID__",
  storageBucket:     "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId:             "__FIREBASE_APP_ID__"
};

export function isFirebaseConfigured() {
  return !firebaseConfig.apiKey.startsWith('__');
}
