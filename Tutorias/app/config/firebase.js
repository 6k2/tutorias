// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
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




// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);