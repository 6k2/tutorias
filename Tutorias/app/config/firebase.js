// Firebase core (browser + RN). Avoid top-level analytics usage to support SSR/static.
// Firebase setup (works on web + native). We keep it chill and SSR-safe, xd
// Avoid top-level analytics init so static builds don't cry.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { Platform } from "react-native";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
} from "firebase/firestore";

let AsyncStorage;
try {
  // Lazy require to avoid native AsyncStorage errors when running outside React Native.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const AsyncStorageModule = require("@react-native-async-storage/async-storage");
  AsyncStorage = AsyncStorageModule?.default ?? AsyncStorageModule;
} catch (_error) {
  AsyncStorage = null;
}

// Firebase project keys. Normally keep these in env for bigger apps.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA7qXv3Ez3SwCAUiFMNBRDRPgrrRqQ0G-A",
  authDomain: "tutorias-7d6f0.firebaseapp.com",
  projectId: "tutorias-7d6f0",
  storageBucket: "tutorias-7d6f0.firebasestorage.app",
  messagingSenderId: "412453792118",
  appId: "1:412453792118:web:34833aee42520382357257",
  measurementId: "G-RM7NE9ZN4L",
};

// Initialize (or reuse) the Firebase app instance
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Export commonly used SDKs
// Use persistent auth on native with AsyncStorage; web falls back to the default auth client.
let _auth;
const shouldUseRNPersistence = AsyncStorage && Platform.OS !== "web";
if (!shouldUseRNPersistence) {
  _auth = getAuth(app);
} else {
  try {
    _auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (_error) {
    _auth = getAuth(app);
  }
}
export const auth = _auth;

// Firestore gets persistent local cache on native so reads/writes survive offline sessions.
// On unsupported devices we warn and downgrade to an in-memory cache so the app still works.
let _db;
if (Platform.OS === "web") {
  _db = getFirestore(app);
} else {
  try {
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(),
      }),
    });
  } catch (error) {
    console.warn(
      "Firestore persistence unavailable, falling back to memory cache",
      error
    );
    try {
      _db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    } catch (_fallbackError) {
      // If Firestore was already initialised (Fast Refresh), grab the existing instance.
      _db = getFirestore(app);
    }
  }
}
export const db = _db;

// Lazily initialize Analytics only in the browser to avoid "window is not defined" during SSR/static
// Lazily initialize Analytics in the browser only (no window? then we bounce)
export const initAnalytics = async () => {
  if (typeof window === "undefined") return null;
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) {
      return getAnalytics(app);
    }
  } catch (_error) {
    // noop: analytics not available in this environment
  }
  return null;
};

export default app;

