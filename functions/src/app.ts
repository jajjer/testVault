import express from "express";
import type { Firestore } from "firebase-admin/firestore";

import { createProjectApiRouter } from "./routes/apiV1.js";

export function createApp(db: Firestore): express.Application {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).type("text/plain").send("ok");
  });

  app.use("/api/v1/projects/:projectId", createProjectApiRouter(db));

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }
      console.error("[api] unhandled", err);
      res.status(500).json({ error: "Internal error" });
    }
  );

  return app;
}
