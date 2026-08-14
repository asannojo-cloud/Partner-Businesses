import { Router } from "express";
import { z } from "zod";
import { listPublicPartners, getPublicPartnerDetail } from "./partners.service";

export const publicPartnersRouter = Router();

const listQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  healthCheck: z.coerce.boolean().optional(),
  memberDiscount: z.coerce.boolean().optional(),
  familyAvailable: z.coerce.boolean().optional(),
  sort: z.enum(["name", "latest", "distance"]).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

publicPartnersRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "검색 조건이 올바르지 않습니다." });
  }
  const result = await listPublicPartners(parsed.data);
  res.json(result);
});

publicPartnersRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "잘못된 기관 ID입니다." });

  const detail = await getPublicPartnerDetail(id);
  if (!detail) return res.status(404).json({ error: "협약기관을 찾을 수 없습니다." });
  res.json(detail);
});
