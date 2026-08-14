import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { adminGuard } from "../../middleware/guards";
import { AppError } from "../../middleware/errorHandler";
import { isValidCategory, isValidSubCategory } from "../../shared/categories";
import { geocodeAddress } from "../geocode/geocode.service";

export const adminPartnersRouter = Router();
adminPartnersRouter.use(adminGuard);

const partnerInputSchema = z.object({
  name: z.string().min(1, "기관명을 입력해주세요."),
  category: z.string().min(1),
  subCategory: z.string().min(1),
  representativeName: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().min(1, "주소를 입력해주세요."),
  detailAddress: z.string().optional(),
  postalCode: z.string().optional(),
  description: z.string().optional(),
});

function validateCategory(category: string, subCategory: string) {
  if (!isValidCategory(category)) {
    throw new AppError(400, "올바르지 않은 대분류입니다.");
  }
  if (!isValidSubCategory(category, subCategory)) {
    throw new AppError(400, "올바르지 않은 세부분류입니다.");
  }
}

adminPartnersRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));

  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];
  function addParam(v: unknown) {
    params.push(v);
    return `$${params.length}`;
  }
  if (q) conditions.push(`(p.name ILIKE ${addParam(`%${q}%`)} OR p.address ILIKE ${addParam(`%${q}%`)})`);
  if (status) conditions.push(`p.status = ${addParam(status)}`);
  if (category) conditions.push(`p.category = ${addParam(category)}`);

  const limitParam = addParam(pageSize);
  const offsetParam = addParam((page - 1) * pageSize);

  const { rows } = await pool.query(
    `SELECT p.*, a.end_date, a.start_date, a.auto_renewal
     FROM partners p
     LEFT JOIN LATERAL (
       SELECT * FROM agreements WHERE partner_id = p.id ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1
     ) a ON true
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params
  );
  const { rows: countRows } = await pool.query(
    `SELECT count(*)::int AS count FROM partners p WHERE ${conditions.join(" AND ")}`,
    params.slice(0, params.length - 2)
  );
  res.json({ items: rows, total: countRows[0].count, page, pageSize });
});

adminPartnersRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(`SELECT * FROM partners WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: "협약기관을 찾을 수 없습니다." });

  const { rows: agreements } = await pool.query(
    `SELECT * FROM agreements WHERE partner_id = $1 ORDER BY end_date DESC NULLS LAST, created_at DESC`,
    [id]
  );
  const { rows: medical } = await pool.query(`SELECT * FROM medical_info WHERE partner_id = $1`, [id]);
  const { rows: images } = await pool.query(`SELECT * FROM partner_images WHERE partner_id = $1 ORDER BY is_main DESC`, [id]);
  const { rows: files } = await pool.query(`SELECT * FROM agreement_files WHERE partner_id = $1 ORDER BY uploaded_at DESC`, [id]);

  res.json({ partner: rows[0], agreements, medical: medical[0] ?? null, images, files });
});

adminPartnersRouter.post("/geocode-preview", async (req, res) => {
  const address = typeof req.body?.address === "string" ? req.body.address : "";
  const result = await geocodeAddress(address);
  res.json(result);
});

adminPartnersRouter.post("/", async (req, res) => {
  const parsed = partnerInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." });
  }
  const input = parsed.data;
  validateCategory(input.category, input.subCategory);

  const geo = await geocodeAddress(input.address);

  const { rows } = await pool.query(
    `INSERT INTO partners (name, category, sub_category, representative_name, phone, website, address, detail_address,
       postal_code, latitude, longitude, geocode_status, description, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')
     RETURNING *`,
    [
      input.name, input.category, input.subCategory, input.representativeName ?? null, input.phone ?? null,
      input.website ?? null, input.address, input.detailAddress ?? null, input.postalCode ?? null,
      geo.latitude, geo.longitude, geo.status, input.description ?? null,
    ]
  );
  res.status(201).json({ partner: rows[0], geocode: geo });
});

adminPartnersRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = partnerInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." });
  }
  const input = parsed.data;
  validateCategory(input.category, input.subCategory);

  const { rows: existingRows } = await pool.query(`SELECT address FROM partners WHERE id = $1`, [id]);
  if (!existingRows[0]) return res.status(404).json({ error: "협약기관을 찾을 수 없습니다." });

  const addressChanged = existingRows[0].address !== input.address;
  const geo = addressChanged
    ? await geocodeAddress(input.address)
    : null;

  const { rows } = await pool.query(
    `UPDATE partners SET
       name=$1, category=$2, sub_category=$3, representative_name=$4, phone=$5, website=$6, address=$7,
       detail_address=$8, postal_code=$9, description=$10, updated_at=now()
       ${geo ? ", latitude=$11, longitude=$12, geocode_status=$13" : ""}
     WHERE id = ${geo ? "$14" : "$11"}
     RETURNING *`,
    geo
      ? [input.name, input.category, input.subCategory, input.representativeName ?? null, input.phone ?? null,
         input.website ?? null, input.address, input.detailAddress ?? null, input.postalCode ?? null,
         input.description ?? null, geo.latitude, geo.longitude, geo.status, id]
      : [input.name, input.category, input.subCategory, input.representativeName ?? null, input.phone ?? null,
         input.website ?? null, input.address, input.detailAddress ?? null, input.postalCode ?? null,
         input.description ?? null, id]
  );
  res.json({ partner: rows[0], geocode: geo });
});

adminPartnersRouter.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (status !== "active" && status !== "inactive") {
    return res.status(400).json({ error: "status는 active 또는 inactive여야 합니다." });
  }
  const { rows } = await pool.query(
    `UPDATE partners SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "협약기관을 찾을 수 없습니다." });
  res.json({ partner: rows[0] });
});

adminPartnersRouter.patch("/:id/representative-image", async (req, res) => {
  const id = Number(req.params.id);
  const imageId = Number(req.body?.imageId);
  if (!Number.isInteger(imageId)) return res.status(400).json({ error: "imageId가 필요합니다." });

  const { rows: imgRows } = await pool.query(
    `SELECT id FROM partner_images WHERE id = $1 AND partner_id = $2`,
    [imageId, id]
  );
  if (!imgRows[0]) return res.status(404).json({ error: "해당 기관의 이미지가 아닙니다." });

  await pool.query(`UPDATE partner_images SET is_main = false WHERE partner_id = $1`, [id]);
  await pool.query(`UPDATE partner_images SET is_main = true WHERE id = $1`, [imageId]);
  await pool.query(`UPDATE partners SET representative_image_id = $1, updated_at = now() WHERE id = $2`, [imageId, id]);
  res.json({ ok: true });
});

adminPartnersRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query(`DELETE FROM partners WHERE id = $1`, [id]);
  if (!rowCount) return res.status(404).json({ error: "협약기관을 찾을 수 없습니다." });
  res.json({ ok: true });
});
