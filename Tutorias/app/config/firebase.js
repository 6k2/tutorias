<<<<<<< Updated upstream
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
=======
// Firebase setup (works on web + native). We keep it chill and SSR-safe, xd
// Avoid top-level analytics init so static builds don’t cry.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getFirestore } from "firebase/firestore";
>>>>>>> Stashed changes

// Firebase project keys. Normally keep these in env for bigger apps.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA7qXv3Ez3SwCAUiFMNBRDRPgrrRqQ0G-A",
  authDomain: "tutorias-7d6f0.firebaseapp.com",
  projectId: "tutorias-7d6f0",
  storageBucket: "tutorias-7d6f0.firebasestorage.app",
  messagingSenderId: "412453792118",
  appId: "1:412453792118:web:34833aee42520382357257",
  measurementId: "G-RM7NE9ZN4L"
};



<<<<<<< Updated upstream
=======
// Lazily initialize Analytics in the browser only (no window? then we bounce)
export const initAnalytics = async () => {
  if (typeof window === "undefined") return null;
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) {
      return getAnalytics(app);
    }
  } catch (e) {
    // noop: analytics not available in this environment
  }
  return null;
};
>>>>>>> Stashed changes

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);