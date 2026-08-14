import { Router } from "express";
import multer from "multer";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import { adminGuard } from "../../middleware/guards";
import { storeFile, deleteFile, readFile } from "./storage.service";
import { DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS, validateUploadedFile } from "../../utils/fileValidation";

export const adminFilesRouter = Router();
adminFilesRouter.use(adminGuard);

const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxDocumentSize } });
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxImageSize, files: 10 } });

// ── 협약서 원본 (PRD 13절) ────────────────────────────────────────────────
adminFilesRouter.post("/agreement/:partnerId", documentUpload.single("file"), async (req, res) => {
  const partnerId = Number(req.params.partnerId);
  if (!req.file) return res.status(400).json({ error: "업로드할 파일이 없습니다." });

  const error = validateUploadedFile(req.file.originalname, req.file.buffer, DOCUMENT_EXTENSIONS);
  if (error) return res.status(400).json({ error });

  const stored = await storeFile("agreement", req.file.buffer, req.file.originalname);
  const agreementSignedDate = req.body?.agreementSignedDate || null;

  // is_public 기본값은 DB상 false지만, 관리자가 업로드하는 협약서는 조합원이 바로 볼 수 있어야
  // 하는 게 일반적인 용도이므로 업로드 시점에 곧바로 공개로 등록한다 (비공개로 두고 싶으면
  // 상세화면의 "공개" 체크박스를 해제하면 된다) — 2026-08-14: "업로드하면 이용자 페이지에서도
  // 바로 보여야 하는데 안 보인다"는 문의에 대응.
  const { rows } = await pool.query(
    `INSERT INTO agreement_files (partner_id, file_name, file_path, file_type, storage_provider, agreement_signed_date, uploaded_by, is_public)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING *`,
    [partnerId, req.file.originalname, stored.storagePath, stored.fileType, stored.storageProvider,
     agreementSignedDate, req.session.auth!.id]
  );
  res.status(201).json({ file: rows[0] });
});

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwpx: "application/haansofthwp", hwp: "application/x-hwp",
};

// 관리자 미리보기용 — is_public 여부와 무관하게 열람할 수 있다 (PRD 33절: 비공개 자료는 관리자 권한 기준).
adminFilesRouter.get("/agreement/:fileId/preview", async (req, res) => {
  const fileId = Number(req.params.fileId);
  const { rows } = await pool.query(`SELECT * FROM agreement_files WHERE id = $1`, [fileId]);
  const file = rows[0];
  if (!file) return res.status(404).json({ error: "협약서 파일을 찾을 수 없습니다." });
  const buffer = await readFile("agreement", file.file_path, file.storage_provider);
  res.setHeader("Content-Type", CONTENT_TYPES[file.file_type] ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  res.send(buffer);
});

adminFilesRouter.patch("/agreement/:fileId/public", async (req, res) => {
  const fileId = Number(req.params.fileId);
  const isPublic = Boolean(req.body?.isPublic);
  const { rows } = await pool.query(
    `UPDATE agreement_files SET is_public = $1 WHERE id = $2 RETURNING *`,
    [isPublic, fileId]
  );
  if (!rows[0]) return res.status(404).json({ error: "협약서 파일을 찾을 수 없습니다." });
  res.json({ file: rows[0] });
});

adminFilesRouter.delete("/agreement/:fileId", async (req, res) => {
  const fileId = Number(req.params.fileId);
  const { rows } = await pool.query(`DELETE FROM agreement_files WHERE id = $1 RETURNING *`, [fileId]);
  if (!rows[0]) return res.status(404).json({ error: "협약서 파일을 찾을 수 없습니다." });
  await deleteFile("agreement", rows[0].file_path, rows[0].storage_provider);
  res.json({ ok: true });
});

// ── 기관 이미지 (PRD 28절) ────────────────────────────────────────────────
adminFilesRouter.post("/image/:partnerId", imageUpload.array("files", 10), async (req, res) => {
  const partnerId = Number(req.params.partnerId);
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "업로드할 이미지가 없습니다." });

  const { rows: existing } = await pool.query(`SELECT count(*)::int AS count FROM partner_images WHERE partner_id = $1`, [partnerId]);
  let isFirstBatch = existing[0].count === 0;

  const inserted = [];
  for (const file of files) {
    const error = validateUploadedFile(file.originalname, file.buffer, IMAGE_EXTENSIONS);
    if (error) return res.status(400).json({ error: `${file.originalname}: ${error}` });

    const stored = await storeFile("image", file.buffer, file.originalname);
    const isMain = isFirstBatch;
    isFirstBatch = false;

    const { rows } = await pool.query(
      `INSERT INTO partner_images (partner_id, file_path, storage_provider, is_main) VALUES ($1,$2,$3,$4) RETURNING *`,
      [partnerId, stored.storagePath, stored.storageProvider, isMain]
    );
    inserted.push(rows[0]);
    if (isMain) {
      await pool.query(`UPDATE partners SET representative_image_id = $1 WHERE id = $2`, [rows[0].id, partnerId]);
    }
  }
  res.status(201).json({ images: inserted });
});

adminFilesRouter.delete("/image/:imageId", async (req, res) => {
  const imageId = Number(req.params.imageId);
  const { rows } = await pool.query(`DELETE FROM partner_images WHERE id = $1 RETURNING *`, [imageId]);
  if (!rows[0]) return res.status(404).json({ error: "이미지를 찾을 수 없습니다." });
  await deleteFile("image", rows[0].file_path, rows[0].storage_provider);
  await pool.query(`UPDATE partners SET representative_image_id = NULL WHERE representative_image_id = $1`, [imageId]);
  res.json({ ok: true });
});
