const fs = require('fs');

// Generate config/firebase.js using Vercel environment variables
const config = `
window.firebaseConfig = {
  apiKey: "${process.env.FIREBASE_API_KEY || 'YOUR_API_KEY'}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT_ID.firebaseapp.com'}",
  projectId: "${process.env.FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID'}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT_ID.appspot.com'}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID'}",
  appId: "${process.env.FIREBASE_APP_ID || 'YOUR_APP_ID'}"
};
`;

if (!fs.existsSync('config')) {
    fs.mkdirSync('config');
}
fs.writeFileSync('config/firebase.js', config);

if (!fs.existsSync('public/config')) {
    fs.mkdirSync('public/config', { recursive: true });
}
fs.writeFileSync('public/config/firebase.js', config);

console.log('Firebase config generated successfully from environment variables.');
