import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Replace with your Firebase project config
// Provide real credentials before running the app
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
