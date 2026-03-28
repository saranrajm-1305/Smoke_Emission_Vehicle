const admin = require("firebase-admin");
const path = require("path");

let db;

function initializeFirebase() {
  if (db) return db;

  let serviceAccount;

  // Try to load from environment variable first (Railway/Production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      // If it's base64 encoded JSON
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
      console.log("Firebase: Loaded credentials from BASE64 environment variable");
    } catch (e1) {
      try {
        // If it's a plain JSON string
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        console.log("Firebase: Loaded credentials from JSON environment variable");
      } catch (e2) {
        console.error("Firebase: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY");
        throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY format");
      }
    }
  } else {
    // Fallback to file (Local Development)
    try {
      const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
      serviceAccount = require(keyPath);
      console.log("Firebase: Loaded credentials from serviceAccountKey.json file");
    } catch (error) {
      console.error("Firebase: Cannot find credentials!");
      console.error("Please either:");
      console.error("1. Add FIREBASE_SERVICE_ACCOUNT_KEY environment variable, OR");
      console.error("2. Add backend/serviceAccountKey.json file");
      throw error;
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  db = admin.firestore();
  console.log("Firebase initialized successfully with real database");
  return db;
}

module.exports = {
  admin,
  db: initializeFirebase(),
};
