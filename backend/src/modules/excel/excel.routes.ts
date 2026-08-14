import { Router } from "express";
import multer from "multer";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import { adminGuard } from "../../middleware/guards";
import { buildTemplateWorkbook, parseWorkbook, computeDiffForJob, applyApprovedRows } from "./excel.service";

export const adminExcelRouter = Router();
adminExcelRouter.use(adminGuard);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxExcelSize } });

adminExcelRouter.get("/template", (req, res) => {
  const buffer = buildTemplateWorkbook();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  // 한글 파일명을 Content-Disposition에 그대로 넣으면 Node가 ERR_INVALID_CHAR로 500을 낸다
  // (HTTP 헤더는 기본적으로 ASCII만 허용) — RFC 5987 filename*=UTF-8'' 형식으로 인코딩해야 한다
  // (2026-08-14 실제 발견 — "업로드 양식 다운로드" 클릭 시 오류).
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="agreement-template.xlsx"; filename*=UTF-8''${encodeURIComponent("협약기관_업로드양식.xlsx")}`
  );
  res.send(buffer);
});

adminExcelRouter.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "업로드할 Excel 파일이 없습니다." });
  const ext = req.file.originalname.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
    return res.status(400).json({ error: "xlsx, xls, csv 파일만 업로드할 수 있습니다." });
  }

  let parsedRows;
  try {
    parsedRows = parseWorkbook(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: "Excel 파일을 읽을 수 없습니다. 양식을 확인해주세요." });
  }
  if (parsedRows.length === 0) {
    return res.status(400).json({ error: "Excel 파일에 데이터가 없습니다." });
  }

  const { rows: jobRows } = await pool.query(
    `INSERT INTO import_jobs (uploaded_by, upload_name, source_type, file_count, status)
     VALUES ($1,$2,'excel',$3,'analyzing') RETURNING *`,
    [req.session.auth!.id, req.file.originalname, parsedRows.length]
  );
  const job = jobRows[0];

  await computeDiffForJob(job.id, parsedRows);
  await pool.query(`UPDATE import_jobs SET status = 'review_ready' WHERE id = $1`, [job.id]);

  res.status(201).json({ jobId: job.id });
});

adminExcelRouter.get("/import/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const { rows: jobRows } = await pool.query(`SELECT * FROM import_jobs WHERE id = $1`, [jobId]);
  if (!jobRows[0]) return res.status(404).json({ error: "업로드 작업을 찾을 수 없습니다." });
  const { rows } = await pool.query(
    `SELECT * FROM excel_import_rows WHERE import_job_id = $1 ORDER BY diff_type, row_number`,
    [jobId]
  );
  res.json({ job: jobRows[0], rows });
});

adminExcelRouter.get("/imports", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM import_jobs WHERE source_type = 'excel' ORDER BY created_at DESC LIMIT 50`
  );
  res.json({ items: rows });
});

adminExcelRouter.post("/import/:jobId/approve", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const rowIds = Array.isArray(req.body?.rowIds) ? req.body.rowIds.map(Number) : [];
  if (rowIds.length === 0) return res.status(400).json({ error: "승인할 항목을 선택해주세요." });

  const results = await applyApprovedRows(jobId, rowIds, req.session.auth!.id);
  res.json({ results });
});
