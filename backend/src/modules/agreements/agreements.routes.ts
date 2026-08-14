import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { adminGuard } from "../../middleware/guards";
import { refreshPartnerCacheFlags } from "../partners/partners.service";

export const adminAgreementsRouter = Router();
adminAgreementsRouter.use(adminGuard);

const agreementSchema = z.object({
  partnerId: z.coerce.number().int(),
  agreementDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  autoRenewal: z.boolean().optional().default(false),
  mainContent: z.string().optional().nullable(),
  memberBenefit: z.string().optional().nullable(),
  familyBenefit: z.string().optional().nullable(),
  usageCondition: z.string().optional().nullable(),
  notice: z.string().optional().nullable(),
});

adminAgreementsRouter.get("/partner/:partnerId", async (req, res) => {
  const partnerId = Number(req.params.partnerId);
  const { rows } = await pool.query(
    `SELECT * FROM agreements WHERE partner_id = $1 ORDER BY end_date DESC NULLS LAST, created_at DESC`,
    [partnerId]
  );
  res.json({ items: rows });
});

adminAgreementsRouter.post("/", async (req, res) => {
  const parsed = agreementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "협약정보 입력값을 확인해주세요." });
  const a = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO agreements
       (partner_id, agreement_date, start_date, end_date, auto_renewal, main_content,
        member_benefit, family_benefit, usage_condition, notice)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [a.partnerId, a.agreementDate, a.startDate, a.endDate, a.autoRenewal, a.mainContent,
     a.memberBenefit, a.familyBenefit, a.usageCondition, a.notice]
  );
  await refreshPartnerCacheFlags(a.partnerId);
  res.status(201).json({ agreement: rows[0] });
});

adminAgreementsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = agreementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "협약정보 입력값을 확인해주세요." });
  const a = parsed.data;

  const { rows } = await pool.query(
    `UPDATE agreements SET
       agreement_date=$1, start_date=$2, end_date=$3, auto_renewal=$4, main_content=$5,
       member_benefit=$6, family_benefit=$7, usage_condition=$8, notice=$9, updated_at=now()
     WHERE id = $10 AND partner_id = $11
     RETURNING *`,
    [a.agreementDate, a.startDate, a.endDate, a.autoRenewal, a.mainContent, a.memberBenefit,
     a.familyBenefit, a.usageCondition, a.notice, id, a.partnerId]
  );
  if (!rows[0]) return res.status(404).json({ error: "협약정보를 찾을 수 없습니다." });
  await refreshPartnerCacheFlags(a.partnerId);
  res.json({ agreement: rows[0] });
});

adminAgreementsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(`DELETE FROM agreements WHERE id = $1 RETURNING partner_id`, [id]);
  if (!rows[0]) return res.status(404).json({ error: "협약정보를 찾을 수 없습니다." });
  await refreshPartnerCacheFlags(rows[0].partner_id);
  res.json({ ok: true });
});
