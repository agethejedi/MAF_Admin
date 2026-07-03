// js/data.js — All Firestore queries for admin portal

let _db = null;

async function db() {
  if (_db) return _db;
  const { initFirebase } = await import('./auth.js');
  const fb = await initFirebase();
  _db = fb.db;
  return _db;
}

export async function getOverviewStats() {
  const { collection, getDocs, query, orderBy, limit } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const d = await db();

  const [usersSnap, codesSnap, scoresSnap] = await Promise.all([
    getDocs(collection(d, 'users')),
    getDocs(collection(d, 'robux_codes')),
    getDocs(collection(d, 'scores'))
  ]);

  const users = [];
  usersSnap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));

  const codes = [];
  codesSnap.forEach(doc => codes.push({ id: doc.id, ...doc.data() }));

  // Fetch sessions
  const allSessions = [];
  await Promise.all(scoresSnap.docs.map(async userDoc => {
    const uid = userDoc.id;
    const sessSnap = await getDocs(
      query(collection(d, 'scores', uid, 'sessions'), orderBy('at', 'desc'), limit(50))
    );
    sessSnap.forEach(s => allSessions.push({ uid, ...s.data() }));
  }));

  // Today/week
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const weekAgo = now - 7 * 86400000;

  const todaySessions = allSessions.filter(s => {
    const d = s.at?.toDate ? s.at.toDate() : new Date(s.at || 0);
    return d >= todayStart;
  });
  const weekSessions = allSessions.filter(s => {
    const d = s.at?.toDate ? s.at.toDate() : new Date(s.at || 0);
    return d.getTime() >= weekAgo;
  });

  // Type accuracy
  const typeMap = {};
  const gradeMap = {};
  allSessions.forEach(s => {
    if (s.grade) gradeMap[s.grade] = (gradeMap[s.grade] || 0) + 1;
    if (!s.typeStats) return;
    Object.entries(s.typeStats).forEach(([t, st]) => {
      if (!typeMap[t]) typeMap[t] = { correct:0, total:0 };
      typeMap[t].correct += st.correct || 0;
      typeMap[t].total   += st.total   || 0;
    });
  });

  const typeAccuracy = Object.entries(typeMap)
    .filter(([,v]) => v.total > 0)
    .map(([type, v]) => ({ type, pct: Math.round(v.correct/v.total*100), total: v.total }))
    .sort((a,b) => a.pct - b.pct);

  const avgPts = allSessions.length
    ? Math.round(allSessions.reduce((s,sess) => s + (sess.weightedPoints||0), 0) / allSessions.length)
    : 0;

  const uniqueActive = new Set(weekSessions.map(s => s.uid)).size;

  return {
    users, codes, allSessions,
    todaySessions: todaySessions.length,
    weekSessions: weekSessions.length,
    totalSessions: allSessions.length,
    avgPts, uniqueActive,
    typeAccuracy, gradeMap,
    availableCodes: codes.filter(c => !c.redeemed).length,
    redeemedCodes:  codes.filter(c =>  c.redeemed).length,
  };
}

export async function getUserSessions(uid, limitN = 20) {
  const { collection, query, orderBy, limit, getDocs } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const d = await db();
  const snap = await getDocs(
    query(collection(d, 'scores', uid, 'sessions'), orderBy('at','desc'), limit(limitN))
  );
  const sessions = [];
  snap.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));
  return sessions;
}

export async function addCode(code, reward) {
  const { collection, doc, setDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const d = await db();
  await setDoc(doc(collection(d, 'robux_codes'), code), {
    reward: reward || '400 Robux Gift Card',
    redeemed: false,
    addedAt: serverTimestamp()
  });
}

export async function deleteCode(code) {
  const { doc, deleteDoc } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const d = await db();
  await deleteDoc(doc(d, 'robux_codes', code));
}

export async function deleteUserData(uid, username) {
  const { doc, deleteDoc, collection, getDocs } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const d = await db();
  // Delete sessions
  const sessSnap = await getDocs(collection(d, 'scores', uid, 'sessions'));
  await Promise.all(sessSnap.docs.map(s => deleteDoc(s.ref)));
  // Delete score doc
  await deleteDoc(doc(d, 'scores', uid)).catch(() => {});
  // Delete robux progress
  const redSnap = await getDocs(collection(d, 'robux_progress', uid, 'redemptions'));
  await Promise.all(redSnap.docs.map(r => deleteDoc(r.ref)));
  await deleteDoc(doc(d, 'robux_progress', uid)).catch(() => {});
  // Delete username
  if (username) await deleteDoc(doc(d, 'usernames', username)).catch(() => {});
  // Delete user doc
  await deleteDoc(doc(d, 'users', uid)).catch(() => {});
}

export async function getFeedback(limitN = 100) {
  const { collection, query, orderBy, limit, getDocs } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const d = await db();
  const snap = await getDocs(
    query(collection(d, 'feedback'), orderBy('at','desc'), limit(limitN))
  );
  const items = [];
  snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
  return items;
}

export function fmtDate(val) {
  if (!val) return '—';
  const d = val?.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

export function downloadCSV(filename, rows, headers) {
  const csv = [headers.join(','), ...rows.map(r =>
    headers.map(h => {
      const v = r[h] ?? '';
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    }).join(',')
  )].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
