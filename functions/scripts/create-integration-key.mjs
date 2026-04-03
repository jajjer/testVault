#!/usr/bin/env node
/**
 * Creates an API key for the integration HTTP API (Azure DevOps / automation).
 * Requires Application Default Credentials (e.g. `gcloud auth application-default login`
 * or GOOGLE_APPLICATION_CREDENTIALS to a service account with Firestore write access).
 *
 * Usage:
 *   node scripts/create-integration-key.mjs <projectId> [label]
 *
 * projectId is your Test Vault Firestore project document id (same as in the app URL).
 */

import * as crypto from "crypto";
import admin from "firebase-admin";

const projectIdArg = process.argv[2];
const label = process.argv[3] ?? "Automation";

if (!projectIdArg) {
  console.error(
    "Usage: node scripts/create-integration-key.mjs <projectId> [label]"
  );
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

const secret = `tvk_${crypto.randomBytes(32).toString("hex")}`;
const keyHash = crypto.createHash("sha256").update(secret, "utf8").digest("hex");

await db.collection("integrationApiKeys").doc(keyHash).set({
  projectId: projectIdArg,
  label,
  createdAt: Date.now(),
});

console.log("");
console.log("API key (store in Azure DevOps secret / pipeline variable — shown once):");
console.log(secret);
console.log("");
