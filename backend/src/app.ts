// 반드시 express보다 먼저 import해야 한다 (async 라우트 핸들러의 예외를 errorHandler로 전달).
import "express-async-errors";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import fs from "fs";
import path from "path";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db/pool";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRateLimiter, loginRateLimiter } from "./middleware/rateLimit";

import { adminAuthRouter } from "./modules/auth/admin.routes";
import { publicPartnersRouter } from "./modules/partners/partners.public.routes";
import { adminPartnersRouter } from "./modules/partners/partners.admin.routes";
import { adminAgreementsRouter } from "./modules/agreements/agreements.routes";
import { adminMedicalRouter } from "./modules/medical/medical.routes";
import { publicFilesRouter } from "./modules/files/files.public.routes";
import { adminFilesRouter } from "./modules/files/files.admin.routes";
import { adminUploadsRouter } from "./modules/uploads/uploads.routes";
import { adminAiRouter } from "./modules/ai/ai.routes";
import { adminExcelRouter } from "./modules/excel/excel.routes";
import { adminDuplicatesRouter } from "./modules/duplicates/duplicates.routes";
import { adminDashboardRouter } from "./modules/dashboard/dashboard.routes";
import { publicCategoriesRouter } from "./modules/partners/categories.routes";

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // 로컬 개발(프론트 :5180 / 백엔드 :4100, 서로 다른 오리진)에서만 CORS가 필요하다.
  // 운영 환경은 백엔드가 프론트 정적 빌드를 함께 서빙해 동일 출처이므로 CORS 자체를 켜지 않는다.
  if (!env.isProduction) {
    app.use(cors({ origin: env.frontendOrigin, credentials: true }));
  }
  app.use(express.json({ limit: "2mb" }));

  app.use(
    session({
      store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
      name: "asanpartners.sid",
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 8, // 8시간
      },
    })
  );

  app.use("/api", apiRateLimiter);

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // ── 공개 API (인증 불필요) ─────────────────────────────────────────────
  app.use("/api/categories", publicCategoriesRouter);
  app.use("/api/partners", publicPartnersRouter);
  app.use("/api/files", publicFilesRouter);

  // ── 관리자 API (세션 인증 필요) ────────────────────────────────────────
  app.use("/api/admin/auth/login", loginRateLimiter);
  app.use("/api/admin/auth", adminAuthRouter);
  app.use("/api/admin/partners", adminPartnersRouter);
  app.use("/api/admin/agreements", adminAgreementsRouter);
  app.use("/api/admin/medical-info", adminMedicalRouter);
  app.use("/api/admin/files", adminFilesRouter);
  app.use("/api/admin/uploads", adminUploadsRouter);
  app.use("/api/admin/ai", adminAiRouter);
  app.use("/api/admin/excel", adminExcelRouter);
  app.use("/api/admin/duplicates", adminDuplicatesRouter);
  app.use("/api/admin/dashboard", adminDashboardRouter);

  app.use("/api", notFoundHandler);

  // 운영 배포: 프론트엔드 정적 빌드(frontend/dist)를 같은 서버에서 함께 서빙한다.
  if (fs.existsSync(env.frontendDistDir)) {
    app.use(express.static(env.frontendDistDir, { index: false }));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(env.frontendDistDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
