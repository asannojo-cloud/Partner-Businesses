import { Router } from "express";
import { pool } from "../../db/pool";
import { adminGuard } from "../../middleware/guards";
import { CATEGORIES } from "../../shared/categories";
import { computeAgreementStatus } from "../../utils/agreementStatus";
import { getTopViewedPartners } from "../partners/partners.service";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(adminGuard);

adminDashboardRouter.get("/", async (req, res) => {
  const { rows: totalRows } = await pool.query(`SELECT count(*)::int AS count FROM partners WHERE status = 'active'`);
  const { rows: inactiveRows } = await pool.query(`SELECT count(*)::int AS count FROM partners WHERE status = 'inactive'`);

  const { rows: byCategoryRows } = await pool.query(
    `SELECT category, count(*)::int AS count FROM partners WHERE status = 'active' GROUP BY category`
  );
  const byCategory = CATEGORIES.map((c) => ({
    category: c.code,
    label: c.label,
    count: byCategoryRows.find((r) => r.category === c.code)?.count ?? 0,
  }));

  const { rows: allAgreements } = await pool.query(
    `SELECT partner_id, end_date, auto_renewal FROM agreements a
     WHERE a.id IN (SELECT max(id) FROM agreements GROUP BY partner_id)`
  );
  let upcomingRenewal = 0;
  let ended = 0;
  for (const a of allAgreements) {
    const status = computeAgreementStatus(a.end_date, a.auto_renewal);
    if (status === "upcoming_renewal") upcomingRenewal++;
    if (status === "ended") ended++;
  }

  const { rows: recentPartners } = await pool.query(
    `SELECT id, name, category, sub_category, created_at FROM partners ORDER BY created_at DESC LIMIT 5`
  );

  const topViewed = await getTopViewedPartners(10);

  res.json({
    totalActivePartners: totalRows[0].count,
    inactivePartners: inactiveRows[0].count,
    byCategory,
    upcomingRenewal,
    ended,
    recentPartners,
    topViewed,
  });
});
