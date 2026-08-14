import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { adminGuard } from "../../middleware/guards";
import { refreshPartnerCacheFlags } from "../partners/partners.service";

export const adminMedicalRouter = Router();
adminMedicalRouter.use(adminGuard);

const medicalSchema = z.object({
  partnerId: z.coerce.number().int(),
  medicalType: z.string().optional().nullable(),
  departments: z.array(z.string()).optional().default([]),
  consultationHours: z.string().optional().nullable(),
  parkingAvailable: z.boolean().optional().nullable(),
  healthCheckAvailable: z.boolean().optional().default(false),
  nationalHealthCheck: z.boolean().optional().default(false),
  generalHealthCheck: z.boolean().optional().default(false),
  comprehensiveHealthCheck: z.boolean().optional().default(false),
  cancerCheck: z.boolean().optional().default(false),
  memberHealthCheck: z.boolean().optional().default(false),
  healthCheckBenefit: z.string().optional().nullable(),
  reservationMethod: z.string().optional().nullable(),
});

adminMedicalRouter.get("/partner/:partnerId", async (req, res) => {
  const partnerId = Number(req.params.partnerId);
  const { rows } = await pool.query(`SELECT * FROM medical_info WHERE partner_id = $1`, [partnerId]);
  res.json({ medical: rows[0] ?? null });
});

// 파트너당 1건이므로 있으면 갱신, 없으면 생성한다 (PRD 9절 의료기관 전용 정보는 partner 부속 정보).
adminMedicalRouter.put("/partner/:partnerId", async (req, res) => {
  const partnerId = Number(req.params.partnerId);
  const parsed = medicalSchema.safeParse({ ...req.body, partnerId });
  if (!parsed.success) return res.status(400).json({ error: "의료기관 정보 입력값을 확인해주세요." });
  const m = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO medical_info
       (partner_id, medical_type, departments, consultation_hours, parking_available,
        health_check_available, national_health_check, general_health_check,
        comprehensive_health_check, cancer_check, member_health_check,
        health_check_benefit, reservation_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (partner_id) DO UPDATE SET
       medical_type=EXCLUDED.medical_type, departments=EXCLUDED.departments,
       consultation_hours=EXCLUDED.consultation_hours, parking_available=EXCLUDED.parking_available,
       health_check_available=EXCLUDED.health_check_available, national_health_check=EXCLUDED.national_health_check,
       general_health_check=EXCLUDED.general_health_check, comprehensive_health_check=EXCLUDED.comprehensive_health_check,
       cancer_check=EXCLUDED.cancer_check, member_health_check=EXCLUDED.member_health_check,
       health_check_benefit=EXCLUDED.health_check_benefit, reservation_method=EXCLUDED.reservation_method,
       updated_at=now()
     RETURNING *`,
    [partnerId, m.medicalType, m.departments, m.consultationHours, m.parkingAvailable,
     m.healthCheckAvailable, m.nationalHealthCheck, m.generalHealthCheck, m.comprehensiveHealthCheck,
     m.cancerCheck, m.memberHealthCheck, m.healthCheckBenefit, m.reservationMethod]
  );
  await refreshPartnerCacheFlags(partnerId);
  res.json({ medical: rows[0] });
});

adminMedicalRouter.delete("/partner/:partnerId", async (req, res) => {
  const partnerId = Number(req.params.partnerId);
  await pool.query(`DELETE FROM medical_info WHERE partner_id = $1`, [partnerId]);
  await refreshPartnerCacheFlags(partnerId);
  res.json({ ok: true });
});
