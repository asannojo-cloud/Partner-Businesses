import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { listPublicPartners, getPublicPartnerDetail, getTopViewedPartners, getPublicPartnerStats } from "./partners.service";

export const publicPartnersRouter = Router();

const listQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  healthCheck: z.coerce.boolean().optional(),
  memberDiscount: z.coerce.boolean().optional(),
  familyAvailable: z.coerce.boolean().optional(),
  sort: z.enum(["name", "latest", "distance", "relevance", "popularity", "recommend"]).optional(),
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

// "/:id"보다 먼저 등록해야 한다 — 그렇지 않으면 "top"/"stats"가 :id로 잡혀 400 오류가 난다.
publicPartnersRouter.get("/top", async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
  const items = await getTopViewedPartners(limit);
  res.json({ items });
});

publicPartnersRouter.get("/stats", async (req, res) => {
  res.json(await getPublicPartnerStats());
});

// 즐겨찾기는 로그인 없이 클라이언트(localStorage)에만 저장되므로 "몇 명이" 즐겨찾기했는지는 알 수
// 없지만, "몇 번" 즐겨찾기 토글이 일어났는지는 이 익명 카운터로 집계해 "추천순" 정렬에 쓴다.
// 로그인이 없어 동일 기기에서의 어뷰징(반복 클릭)까지 막지는 못하지만, 조합원 내부용 안내 앱
// 특성상 심각한 문제는 아니라고 판단했다 (2026-08-18).
publicPartnersRouter.post("/:id/favorite", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "잘못된 기관 ID입니다." });
  await pool.query(`UPDATE partners SET favorite_count = favorite_count + 1 WHERE id = $1`, [id]);
  res.json({ ok: true });
});

publicPartnersRouter.delete("/:id/favorite", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "잘못된 기관 ID입니다." });
  await pool.query(`UPDATE partners SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = $1`, [id]);
  res.json({ ok: true });
});

publicPartnersRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "잘못된 기관 ID입니다." });

  const detail = await getPublicPartnerDetail(id);
  if (!detail) return res.status(404).json({ error: "협약기관을 찾을 수 없습니다." });
  res.json(detail);
});
