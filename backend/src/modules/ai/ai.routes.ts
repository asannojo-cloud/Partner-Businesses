import { Router } from "express";
import { pool } from "../../db/pool";
import { adminGuard } from "../../middleware/guards";
import { analyzeImportJob, approveCandidate } from "./ai.service";
import { PartnerCandidate } from "./ai.types";

export const adminAiRouter = Router();
adminAiRouter.use(adminGuard);

adminAiRouter.get("/jobs", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT j.*, (SELECT count(*)::int FROM ai_extracted_partners a WHERE a.import_job_id = j.id AND a.review_status = 'pending') AS pending_review_count
     FROM import_jobs j ORDER BY created_at DESC LIMIT 100`
  );
  res.json({ items: rows });
});

adminAiRouter.get("/jobs/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const { rows: jobRows } = await pool.query(`SELECT * FROM import_jobs WHERE id = $1`, [jobId]);
  if (!jobRows[0]) return res.status(404).json({ error: "업로드 작업을 찾을 수 없습니다." });
  const { rows: documents } = await pool.query(
    `SELECT id, file_name, relative_path, file_type, processing_status, error_message FROM extracted_documents WHERE import_job_id = $1 ORDER BY relative_path, file_name`,
    [jobId]
  );
  const { rows: candidates } = await pool.query(
    `SELECT * FROM ai_extracted_partners WHERE import_job_id = $1 ORDER BY id`,
    [jobId]
  );
  res.json({ job: jobRows[0], documents, candidates });
});

adminAiRouter.post("/jobs/:jobId/analyze", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const { rows } = await pool.query(`SELECT id, status FROM import_jobs WHERE id = $1`, [jobId]);
  if (!rows[0]) return res.status(404).json({ error: "업로드 작업을 찾을 수 없습니다." });
  if (rows[0].status === "analyzing") {
    return res.status(409).json({ error: "이미 분석이 진행 중입니다." });
  }

  // 분석은 문서 개수에 따라 다소 시간이 걸릴 수 있어 백그라운드로 실행하고 즉시 202를 반환한다.
  // 프론트엔드는 GET /jobs/:jobId를 폴링해 상태(status)를 확인한다.
  analyzeImportJob(jobId).catch((err) => console.error(`[ai] job ${jobId} 분석 실패:`, err));
  res.status(202).json({ ok: true, status: "analyzing" });
});

adminAiRouter.get("/review", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const { rows } = await pool.query(
    `SELECT * FROM ai_extracted_partners WHERE review_status = $1 ORDER BY created_at ASC`,
    [status]
  );
  res.json({ items: rows });
});

adminAiRouter.get("/review/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(`SELECT * FROM ai_extracted_partners WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: "검토 대상을 찾을 수 없습니다." });

  const { rows: documents } = await pool.query(
    `SELECT id, file_name, relative_path, file_type, extracted_text, processing_status FROM extracted_documents WHERE id = ANY($1)`,
    [rows[0].source_document_ids]
  );
  let duplicate = null;
  if (rows[0].duplicate_partner_id) {
    const { rows: dupRows } = await pool.query(`SELECT id, name, address FROM partners WHERE id = $1`, [rows[0].duplicate_partner_id]);
    duplicate = dupRows[0] ?? null;
  }
  res.json({ candidate: rows[0], documents, duplicate });
});

const EDITABLE_COLUMNS: Record<string, string> = {
  partnerName: "partner_name", category: "category", subCategory: "sub_category", phone: "phone",
  website: "website", address: "address", agreementDate: "agreement_date", startDate: "start_date",
  endDate: "end_date", mainContent: "main_content", memberBenefit: "member_benefit",
  familyBenefit: "family_benefit", usageCondition: "usage_condition", notice: "notice",
  healthCheckAvailable: "health_check_available", healthCheckTypes: "health_check_types",
  departments: "departments",
};

adminAiRouter.patch("/review/:id", async (req, res) => {
  const id = Number(req.params.id);
  const updates: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(EDITABLE_COLUMNS)) {
    if (key in (req.body ?? {})) {
      params.push(req.body[key]);
      updates.push(`${column} = $${params.length}`);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: "수정할 필드가 없습니다." });
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE ai_extracted_partners SET ${updates.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: "검토 대상을 찾을 수 없습니다." });
  res.json({ candidate: rows[0] });
});

adminAiRouter.post("/review/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const overrides = req.body?.overrides as Partial<PartnerCandidate> | undefined;
  try {
    const result = await approveCandidate(id, req.session.auth!.id, overrides ?? {});
    res.json({ ok: true, partnerId: result.partnerId });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "승인 처리 중 오류가 발생했습니다." });
  }
});

adminAiRouter.post("/review/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(
    `UPDATE ai_extracted_partners SET review_status = 'rejected', reviewed_by = $1, reviewed_at = now() WHERE id = $2 RETURNING *`,
    [req.session.auth!.id, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "검토 대상을 찾을 수 없습니다." });
  res.json({ ok: true });
});

adminAiRouter.delete("/review/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query(`DELETE FROM ai_extracted_partners WHERE id = $1`, [id]);
  if (!rowCount) return res.status(404).json({ error: "검토 대상을 찾을 수 없습니다." });
  res.json({ ok: true });
});
