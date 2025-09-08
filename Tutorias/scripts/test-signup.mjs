import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA7qXv3Ez3SwCAUiFMNBRDRPgrrRqQ0G-A",
  authDomain: "tutorias-7d6f0.firebaseapp.com",
  projectId: "tutorias-7d6f0",
  storageBucket: "tutorias-7d6f0.firebasestorage.app",
  messagingSenderId: "412453792118",
  appId: "1:412453792118:web:34833aee42520382357257",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const email = process.env.TEST_EMAIL || `test+${Date.now()}@example.com`;
  const password = process.env.TEST_PASSWORD || 'testing123';
  const username = 'Test User';
  const role = 'Student';

  console.log('Creating test user:', email);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  console.log('Auth created:', uid);

  const ref = doc(db, 'users', uid);
  await setDoc(ref, { uid, email, username, role, createdAt: new Date() }, { merge: true });
  const snap = await getDoc(ref);
  console.log('User doc exists:', snap.exists());
  if (!snap.exists()) process.exit(1);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

