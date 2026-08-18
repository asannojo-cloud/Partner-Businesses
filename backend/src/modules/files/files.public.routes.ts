import { Router } from "express";
import { pool } from "../../db/pool";
import { readFile } from "./storage.service";

export const publicFilesRouter = Router();

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwpx: "application/haansofthwp",
  hwp: "application/x-hwp",
};

publicFilesRouter.get("/agreement/:fileId", async (req, res) => {
  const fileId = Number(req.params.fileId);
  const { rows } = await pool.query(
    `SELECT * FROM agreement_files WHERE id = $1 AND is_public = true`,
    [fileId]
  );
  const file = rows[0];
  if (!file) return res.status(404).json({ error: "공개된 협약서 파일이 아니거나 존재하지 않습니다." });

  // storage_provider='local'인 옛 파일은 Render 재배포로 실제 파일이 사라졌을 수 있다
  // (2026-08-18 실제 발견 — 휘발성 로컬 디스크). 그런 경우 500 대신 404로 명확히 응답한다.
  let buffer: Buffer;
  try {
    buffer = await readFile("agreement", file.file_path, file.storage_provider);
  } catch {
    return res.status(404).json({ error: "파일을 찾을 수 없습니다. 관리자에게 재업로드를 요청해주세요." });
  }
  res.setHeader("Content-Type", CONTENT_TYPES[file.file_type] ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  res.send(buffer);
});

publicFilesRouter.get("/image/:imageId", async (req, res) => {
  const imageId = Number(req.params.imageId);
  const { rows } = await pool.query(`SELECT * FROM partner_images WHERE id = $1`, [imageId]);
  const image = rows[0];
  if (!image) return res.status(404).json({ error: "이미지를 찾을 수 없습니다." });

  let buffer: Buffer;
  try {
    buffer = await readFile("image", image.file_path, image.storage_provider);
  } catch {
    return res.status(404).json({ error: "이미지 파일을 찾을 수 없습니다." });
  }
  const ext = image.file_path.split(".").pop()?.toLowerCase() ?? "";
  res.setHeader("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(buffer);
});
