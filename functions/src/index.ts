import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

import { createApp } from "./app.js";

setGlobalOptions({ region: "us-central1", maxInstances: 20 });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const api = onRequest(
  {
    cors: true,
    invoker: "public",
  },
  createApp(db)
);
