require("dotenv").config();
const admin = require("firebase-admin");
const { Pool } = require("pg");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error(
    "Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al archivo JSON) o FIREBASE_SERVICE_ACCOUNT_JSON en las variables de entorno"
  );
}

if (!process.env.COCKROACH_DATABASE_URL) {
  throw new Error("Falta la variable de entorno COCKROACH_DATABASE_URL en .env");
}

if (!admin.apps.length) {
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : admin.credential.applicationDefault();

  admin.initializeApp({ credential });
}

const firestore = admin.firestore();
const auth = admin.auth();

const pool = new Pool({
  connectionString: process.env.COCKROACH_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

module.exports = {
  admin,
  firestore,
  auth,
  pool,
};
