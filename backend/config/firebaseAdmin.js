const admin = require("firebase-admin");
const path = require("path");

let db;

function initializeFirebase() {
  if (db) return db;

  const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
  const serviceAccount = require(keyPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  db = admin.firestore();
  return db;
}

module.exports = {
  admin,
  db: initializeFirebase(),
};
