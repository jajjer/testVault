import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Railyard uses Firebase for auth and data. For HIPAA-regulated workloads:
 * - Prefer a dedicated GCP project with a signed BAA and Firebase/Google Cloud configured per policy.
 * - Avoid storing PHI/PII in test titles, steps, or attachments; treat attachments as sensitive.
 * - Enable audit logging, least-privilege IAM, and strict Firestore/Storage security rules in production.
 */
const required = (key: string): string => {
  const v = import.meta.env[key as keyof ImportMetaEnv];
  if (!v || String(v).trim() === "") {
    throw new Error(
      `Missing ${String(key)}. Copy .env.example to .env and add your Firebase web app config.`
    );
  }
  return v;
};

function buildFirebaseConfig() {
  return {
    apiKey: required("VITE_FIREBASE_API_KEY"),
    authDomain: required("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: required("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: required("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: required("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: required("VITE_FIREBASE_APP_ID"),
    measurementId:
      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
  };
}

let app: FirebaseApp;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(buildFirebaseConfig());
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getFirestoreDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(getFirebaseApp());
  }
  return storageInstance;
}
