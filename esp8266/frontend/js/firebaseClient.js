import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDcnLdT8qIIWNcZ_JQs88wNPzftbFbREs",
  authDomain: "vehicle-emission-bfaad.firebaseapp.com",
  projectId: "vehicle-emission-bfaad",
  storageBucket: "vehicle-emission-bfaad.firebasestorage.app",
  messagingSenderId: "225366456394",
  appId: "1:225366456394:web:551ee7105040210e6a8eb3",
  measurementId: "G-YK23MJZ2CV",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, analytics, db, collection, onSnapshot, query, orderBy, limit };
