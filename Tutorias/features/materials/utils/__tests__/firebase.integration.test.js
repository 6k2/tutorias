import { deleteUser, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import app, { auth, db } from '../../../../app/config/firebase';

jest.setTimeout(30000);

const BASE_EMAIL = `integration-user-${Date.now()}`;
const TEST_PASSWORD = 'Tut0rias2025!';

let createdUser = null;

async function cleanupAuthUser() {
  if (!createdUser) return;
  const userDoc = doc(db, 'users', createdUser.uid);
  try {
    await deleteDoc(userDoc);
  } catch {
    // tolerate cleanup failures
  }
  try {
    await deleteUser(createdUser);
  } catch {
    // continue even if Firebase refuses; the test already created the user
  }
  try {
    await signOut(auth);
  } catch {
    // ignore sign-out errors
  }
  createdUser = null;
}

afterEach(async () => {
  await cleanupAuthUser();
});

describe('Firebase real integrations', () => {
  it('crea un usuario real en Firebase Auth y guarda su perfil', async () => {
    const uniqueEmail = `${BASE_EMAIL}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const credential = await createUserWithEmailAndPassword(auth, uniqueEmail, TEST_PASSWORD);
    const user = credential.user;
    createdUser = user;

    expect(user.email).toBe(uniqueEmail);
    const userRef = doc(db, 'users', user.uid);
    const payload = {
      matricula: 'MATRICULA-DEP',
      role: 'student',
      createdAt: new Date(),
    };
    await setDoc(userRef, payload);

    const snapshot = await getDoc(userRef);
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()?.matricula).toBe(payload.matricula);
  });

  it('obtiene la matrícula desde Firestore usando el documento real del proyecto', async () => {
    const userKey = `integration-matricula-${Math.random().toString(36).slice(2, 8)}`;
    const expectedMatricula = `MAT-${Date.now()}`;
    const userRef = doc(db, 'users', userKey);
    await setDoc(userRef, { matricula: expectedMatricula, role: 'student', updatedAt: new Date() });

    const snapshot = await getDoc(userRef);
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()?.matricula).toBe(expectedMatricula);

    await deleteDoc(userRef);
  });
});

afterAll(async () => {
  await cleanupAuthUser();
  try {
    await db.terminate();
  } catch {
    // ignore termination errors
  }
  try {
    await app.delete();
  } catch {
    // ignore cleanup errors
  }
});
