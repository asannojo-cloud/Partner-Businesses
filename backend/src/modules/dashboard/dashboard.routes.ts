import { Router } from "express";
import { pool } from "../../db/pool";
import { adminGuard } from "../../middleware/guards";
import { CATEGORIES } from "../../shared/categories";
import { computeAgreementStatus } from "../../utils/agreementStatus";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(adminGuard);

adminDashboardRouter.get("/", async (req, res) => {
  const { rows: totalRows } = await pool.query(`SELECT count(*)::int AS count FROM partners WHERE status = 'active'`);

  const { rows: byCategoryRows } = await pool.query(
    `SELECT category, count(*)::int AS count FROM partners WHERE status = 'active' GROUP BY category`
  );
  const byCategory = CATEGORIES.map((c) => ({
    category: c.code,
    label: c.label,
    count: byCategoryRows.find((r) => r.category === c.code)?.count ?? 0,
  }));

  const { rows: pendingUploadJobs } = await pool.query(
    `SELECT count(*)::int AS count FROM import_jobs WHERE status IN ('uploaded', 'analyzing')`
  );
  const { rows: pendingReview } = await pool.query(
    `SELECT count(*)::int AS count FROM ai_extracted_partners WHERE review_status = 'pending'`
  );

  const { rows: allAgreements } = await pool.query(
    `SELECT partner_id, end_date FROM agreements a
     WHERE a.id IN (SELECT max(id) FROM agreements GROUP BY partner_id)`
  );
  let upcomingRenewal = 0;
  let ended = 0;
  for (const a of allAgreements) {
    const status = computeAgreementStatus(a.end_date);
    if (status === "upcoming_renewal") upcomingRenewal++;
    if (status === "ended") ended++;
  }

  const { rows: recentPartners } = await pool.query(
    `SELECT id, name, category, sub_category, created_at FROM partners ORDER BY created_at DESC LIMIT 5`
  );

  res.json({
    totalActivePartners: totalRows[0].count,
    byCategory,
    pendingUploadJobs: pendingUploadJobs[0].count,
    pendingReview: pendingReview[0].count,
    upcomingRenewal,
    ended,
    recentPartners,
  });
});
