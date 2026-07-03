// build.js — Inject Firebase config secrets at build time
const fs = require('fs');
const path = require('path');

const replacements = {
  '__FIREBASE_API_KEY__':            process.env.FIREBASE_API_KEY            || '',
  '__FIREBASE_AUTH_DOMAIN__':        process.env.FIREBASE_AUTH_DOMAIN        || '',
  '__FIREBASE_PROJECT_ID__':         process.env.FIREBASE_PROJECT_ID         || '',
  '__FIREBASE_STORAGE_BUCKET__':     process.env.FIREBASE_STORAGE_BUCKET     || '',
  '__FIREBASE_MESSAGING_SENDER_ID__':process.env.FIREBASE_MESSAGING_SENDER_ID|| '',
  '__FIREBASE_APP_ID__':             process.env.FIREBASE_APP_ID             || '',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (content.includes(placeholder)) {
      content = content.split(placeholder).join(value);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(filePath, content);
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules','.git'].includes(file)) walkDir(full);
    } else if (file.endsWith('.js') || file.endsWith('.html')) {
      processFile(full);
    }
  });
}

walkDir('.');
console.log('Build complete — Firebase config injected');
