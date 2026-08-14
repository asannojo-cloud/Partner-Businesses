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

  const buffer = await readFile("agreement", file.file_path, file.storage_provider);
  res.setHeader("Content-Type", CONTENT_TYPES[file.file_type] ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  res.send(buffer);
});

publicFilesRouter.get("/image/:imageId", async (req, res) => {
  const imageId = Number(req.params.imageId);
  const { rows } = await pool.query(`SELECT * FROM partner_images WHERE id = $1`, [imageId]);
  const image = rows[0];
  if (!image) return res.status(404).json({ error: "이미지를 찾을 수 없습니다." });

  const buffer = await readFile("image", image.file_path, image.storage_provider);
  const ext = image.file_path.split(".").pop()?.toLowerCase() ?? "";
  res.setHeader("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(buffer);
});
