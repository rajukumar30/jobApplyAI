import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC8gwmQAoI8MzpgTUYwTwsoG5z8aulKTII",
  authDomain: "jobapply-ai-c597b.firebaseapp.com",
  projectId: "jobapply-ai-c597b",
  storageBucket: "jobapply-ai-c597b.firebasestorage.app",
  messagingSenderId: "741158595027",
  appId: "1:741158595027:web:f21fb2d26317f6d09be726",
  measurementId: "G-Q0BYHK3R5Z"
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider, signInWithPopup, signOut };
