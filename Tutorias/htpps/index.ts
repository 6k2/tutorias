import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const createUserHttp = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Use POST to create a user.'
    });
  }

  const { email, password, displayName } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Both email and password are required.'
    });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName
    });

    return res.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    });
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };
    const statusCode = firebaseError.code === 'auth/email-already-exists' ? 409 : 500;

    return res.status(statusCode).json({
      error: firebaseError.code ?? 'internal-error',
      message: firebaseError.message ?? 'Failed to create user.'
    });
  }
});
