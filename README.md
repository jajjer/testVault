# Test Vault

Self-hosted, Firebase-backed test management: projects, nested folders for test cases, test runs, and pass/fail results—similar in spirit to tools like TestRail, but under your own Firebase project.

## Features

- **Auth & roles** — Email/password sign-in; `admin`, `test_lead`, and `tester` roles (Firestore rules + UI).
- **Projects** — Multi-project workspace with optional parameters metadata.
- **Test cases** — Titles, steps, priority/type/status, custom fields, TestRail-style case IDs (`C1`, `C2`, …).
- **Folders** — Nested sections; drag-and-drop or dialogs to move cases; folder-scoped selection when building test runs.
- **Test runs** — Snapshot a set of cases (by folder or individually), edit runs, record results per case.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Zustand, React Router, Vitest for unit tests.
- **Backend:** Firebase (Authentication, Firestore, Storage), security rules in-repo (`firestore.rules`, `storage.rules`).
- **Automation API:** Cloud Functions (HTTPS) + API keys for CI (e.g. Azure DevOps) — see [Integration API](#integration-api-azure-devops--selenium) below.

## Prerequisites

- Node.js 20+ (or current LTS) and npm
- A [Firebase](https://console.firebase.google.com/) project with **Authentication** (Email/Password), **Firestore**, and **Storage** enabled
- **Cloud Functions** (for the HTTP integration API): requires the Firebase project to be on a **Blaze** (pay-as-you-go) plan

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   npm install --prefix functions
   ```

2. Copy environment variables and add your Firebase web app config:

   ```bash
   cp .env.example .env
   ```

   Fill in all `VITE_FIREBASE_*` values from **Project settings → Your apps** in the Firebase console. `VITE_FIREBASE_MEASUREMENT_ID` is optional (Analytics).

3. Deploy Firestore and Storage rules (from the project directory, with [Firebase CLI](https://firebase.google.com/docs/cli) logged in):

   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Run unit tests (optional):

   ```bash
   npm run test
   ```

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Vite dev server                     |
| `npm run build`     | Typecheck + production build        |
| `npm run preview`   | Preview production build locally    |
| `npm run lint`      | ESLint                              |
| `npm run test`      | Vitest (app + Cloud Functions)      |
| `npm run test:watch`| Vitest in watch mode                |
| `npm run deploy`    | Production build + Firebase deploy (hosting, rules, **functions**) |

## Integration API (Azure DevOps / Selenium)

The integration API runs in the same Firebase project as **HTTPS Cloud Function** `api`. After deploy, it is available at:

- **Same origin as the app (recommended):** `https://<your-hosting-domain>/api/v1/...`  
  Firebase Hosting rewrites `/api/**` to the function (see `firebase.json`).

Auth: send the secret key as `Authorization: Bearer <key>` or header `X-TestVault-Api-Key: <key>`. Keys are stored under Firestore `integrationApiKeys/{sha256(key)}` (only the Admin SDK can read them).

### Create an API key (one-time per project)

From the repo root, with [Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc) (e.g. `gcloud auth application-default login`):

```bash
node functions/scripts/create-integration-key.mjs <firestoreProjectId> "Azure DevOps"
```

`<firestoreProjectId>` is the **Test Vault project** document id (the project you open in the app). The script prints the key once — store it in an Azure DevOps **secret variable** (e.g. `TESTVAULT_API_KEY`).

### T numbers and results

When a **test run** is created, each included case gets a **T number** (`T1`, `T2`, …) unique in that run (backed by `runTestNumbers` in Firestore). To log automation results, use **`runTestNumber`** in the JSON body — the API resolves it to the correct case and writes to `projects/{projectId}/runs/{runId}/results/{caseId}`.

### Endpoints

Base path: `/api/v1/projects/{projectId}` (`projectId` = Firestore project id).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/runs` | Create a run. Body: `{ "name": string, "caseNumbers": number[] }` (C numbers: `1` → C1) **or** `{ "name", "caseIds": string[] }`. Returns `runId` and `runTestNumbers` (map of case id → integer for T). |
| `GET` | `/runs/{runId}` | Run metadata and `runTestNumbers`. |
| `POST` | `/runs/{runId}/results` | Submit results by T number. Single: `{ "runTestNumber": 3, "outcome": "passed", "comment": "optional" }`. Batch: `{ "results": [ { "runTestNumber", "outcome", "comment?" }, ... ] }`. Outcomes: `passed`, `failed`, `blocked`, `skipped`, `retest`. |

Example (curl):

```bash
export BASE=https://<your-project>.web.app
export PID=<firestoreProjectId>
export KEY=<api_key>

curl -sS -X POST "$BASE/api/v1/projects/$PID/runs" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nightly ADO","caseNumbers":[1,2,3]}'

curl -sS -X POST "$BASE/api/v1/projects/$PID/runs/<runId>/results" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"results":[{"runTestNumber":1,"outcome":"passed"},{"runTestNumber":2,"outcome":"failed","comment":"Assert text"}]}'
```

Deploy the function with the rest of the stack:

```bash
npm run deploy
```

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).
