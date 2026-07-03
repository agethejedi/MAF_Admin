// js/auth.js — Admin authentication

import { firebaseConfig } from './firebase-config.js';

const WORKER_URL = 'https://mafv5.agedotcom.workers.dev';

let _app = null;
let _auth = null;
let _db = null;

export async function initFirebase() {
  if (_app) return { app: _app, auth: _auth, db: _db };
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  _app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db   = getFirestore(_app);
  return { app: _app, auth: _auth, db: _db };
}

export async function signIn(email, password) {
  const { auth } = await initFirebase();
  const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  const { auth } = await initFirebase();
  const { signOut: fbSignOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  await fbSignOut(auth);
  localStorage.removeItem('maf_admin_user');
  location.href = '/index.html';
}

export async function checkAdminRole(uid) {
  const { db } = await initFirebase();
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() && snap.data().role === 'admin';
}

export async function getCurrentAdmin() {
  const stored = localStorage.getItem('maf_admin_user');
  if (!stored) return null;
  const user = JSON.parse(stored);
  // Verify role is still admin
  const ok = await checkAdminRole(user.uid).catch(() => false);
  if (!ok) {
    localStorage.removeItem('maf_admin_user');
    return null;
  }
  return user;
}

export async function registerAdmin(email, password, bearerToken) {
  // Verify bearer token via Worker
  const res = await fetch(`${WORKER_URL}/admin/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, bearerToken })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export function toast(msg, type = 'correct') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.borderColor = type === 'correct' ? 'var(--green)' : 'var(--red)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}
