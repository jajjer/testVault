import type { Request, Response } from "express";
import { Router } from "express";
import type { Firestore } from "firebase-admin/firestore";

import { createTestRun, loadRun } from "../lib/createRun.js";
import { resolveCaseNumbersToIds } from "../lib/resolveCaseNumbers.js";
import { caseIdForRunTestNumber } from "../lib/runTestNumber.js";
import { createApiKeyMiddleware } from "../middleware/apiKeyAuth.js";

const OUTCOMES = new Set([
  "passed",
  "failed",
  "blocked",
  "skipped",
  "retest",
]);

function isOutcome(v: unknown): v is string {
  return typeof v === "string" && OUTCOMES.has(v);
}

/**
 * Routes under `/api/v1/projects/:projectId/*` so `projectId` is always in req.params.
 */
export function createProjectApiRouter(db: Firestore): Router {
  const r = Router({ mergeParams: true });
  r.use(createApiKeyMiddleware({ db }));

  r.post("/runs", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const body = req.body as {
        name?: unknown;
        caseIds?: unknown;
        caseNumbers?: unknown;
      };

      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }

      const hasIds = Array.isArray(body.caseIds);
      const hasNums = Array.isArray(body.caseNumbers);
      if (hasIds && hasNums) {
        res.status(400).json({
          error: "Provide only one of caseIds or caseNumbers",
        });
        return;
      }
      if (!hasIds && !hasNums) {
        res.status(400).json({
          error: "Provide caseIds (Firestore ids) or caseNumbers (e.g. 1 for C1)",
        });
        return;
      }

      let caseIds: string[];
      if (hasIds) {
        const raw = body.caseIds as unknown[];
        caseIds = raw.map((x) => String(x).trim()).filter(Boolean);
        if (caseIds.length !== raw.length) {
          res.status(400).json({ error: "caseIds must be non-empty strings" });
          return;
        }
        const u = new Set(caseIds);
        if (u.size !== caseIds.length) {
          res.status(400).json({ error: "caseIds must be unique" });
          return;
        }
      } else {
        const raw = body.caseNumbers as unknown[];
        const nums: number[] = [];
        for (const x of raw) {
          if (typeof x !== "number" || !Number.isInteger(x) || x < 1) {
            res.status(400).json({
              error:
                "Each caseNumbers entry must be a positive integer (C number)",
            });
            return;
          }
          nums.push(x);
        }
        if (nums.length === 0) {
          res.status(400).json({ error: "caseNumbers must be non-empty" });
          return;
        }
        caseIds = await resolveCaseNumbersToIds(db, projectId, nums);
      }

      const runId = await createTestRun(db, projectId, {
        name,
        caseIds,
        createdBy: "integration",
      });

      const run = await loadRun(db, projectId, runId);
      res.status(201).json({
        runId,
        name,
        caseIds,
        runTestNumbers: run?.runTestNumbers ?? {},
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
        return;
      }
      console.error("[api] POST runs", e);
      res.status(500).json({ error: "Failed to create run" });
    }
  });

  r.get("/runs/:runId", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const runId = req.params.runId as string;
      const run = await loadRun(db, projectId, runId);
      if (!run) {
        res.status(404).json({ error: "Run not found" });
        return;
      }
      res.json({
        runId,
        name: run.name,
        status: run.status,
        caseIds: run.caseIds,
        runTestNumbers: run.runTestNumbers,
      });
    } catch (e) {
      console.error("[api] GET run", e);
      res.status(500).json({ error: "Failed to load run" });
    }
  });

  r.post("/runs/:runId/results", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const runId = req.params.runId as string;

      const run = await loadRun(db, projectId, runId);
      if (!run) {
        res.status(404).json({ error: "Run not found" });
        return;
      }

      const body = req.body as {
        results?: unknown;
        runTestNumber?: unknown;
        outcome?: unknown;
        comment?: unknown;
      };

      type Row = { runTestNumber: number; outcome: string; comment?: string };
      let rows: Row[];

      if (Array.isArray(body.results)) {
        rows = [];
        for (const item of body.results) {
          if (!item || typeof item !== "object") {
            res
              .status(400)
              .json({ error: "Each results item must be an object" });
            return;
          }
          const o = item as Record<string, unknown>;
          const rt = o.runTestNumber;
          const oc = o.outcome;
          if (typeof rt !== "number" || !Number.isInteger(rt) || rt < 1) {
            res.status(400).json({
              error:
                "Each result needs runTestNumber (positive integer T number)",
            });
            return;
          }
          if (!isOutcome(oc)) {
            res.status(400).json({
              error: `Invalid outcome (use ${[...OUTCOMES].join(", ")})`,
            });
            return;
          }
          const comment =
            o.comment === undefined || o.comment === null
              ? undefined
              : String(o.comment);
          rows.push({ runTestNumber: rt, outcome: oc, comment });
        }
      } else if (
        body.runTestNumber !== undefined &&
        body.outcome !== undefined
      ) {
        const rt = body.runTestNumber;
        const oc = body.outcome;
        if (typeof rt !== "number" || !Number.isInteger(rt) || rt < 1) {
          res.status(400).json({
            error:
              "runTestNumber must be a positive integer (T number in this run)",
          });
          return;
        }
        if (!isOutcome(oc)) {
          res.status(400).json({
            error: `Invalid outcome (use ${[...OUTCOMES].join(", ")})`,
          });
          return;
        }
        const comment =
          body.comment === undefined || body.comment === null
            ? undefined
            : String(body.comment);
        rows = [{ runTestNumber: rt, outcome: oc, comment }];
      } else {
        res.status(400).json({
          error:
            "Send { runTestNumber, outcome, comment? } or { results: [...] }",
        });
        return;
      }

      if (rows.length === 0) {
        res.status(400).json({ error: "No results to apply" });
        return;
      }

      const now = Date.now();
      const written: { runTestNumber: number; caseId: string }[] = [];

      for (const row of rows) {
        const caseId = caseIdForRunTestNumber(
          run.runTestNumbers,
          row.runTestNumber
        );
        if (!caseId) {
          res.status(400).json({
            error: `No test case for runTestNumber T${row.runTestNumber} in this run`,
          });
          return;
        }

        const ref = db
          .collection("projects")
          .doc(projectId)
          .collection("runs")
          .doc(runId)
          .collection("results")
          .doc(caseId);

        const prevSnap = await ref.get();
        const prev = prevSnap.exists ? prevSnap.data()! : {};
        const prevAttachments = Array.isArray(prev.attachments)
          ? prev.attachments
          : [];

        const comment =
          row.comment !== undefined
            ? row.comment
            : String(prev.comment ?? "");

        await ref.set(
          {
            caseId,
            runId,
            projectId,
            outcome: row.outcome,
            comment,
            attachments: prevAttachments,
            executedBy: "integration",
            executedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        written.push({ runTestNumber: row.runTestNumber, caseId });
      }

      res.json({ ok: true, updated: written });
    } catch (e) {
      console.error("[api] POST results", e);
      res.status(500).json({ error: "Failed to write results" });
    }
  });

  return r;
}
