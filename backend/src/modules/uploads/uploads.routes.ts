import { Router } from "express";
import multer from "multer";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import { adminGuard } from "../../middleware/guards";
import { storeFile } from "../files/storage.service";
import { DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS, extensionOf, validateUploadedFile } from "../../utils/fileValidation";

export const adminUploadsRouter = Router();
adminUploadsRouter.use(adminGuard);

const ALLOWED_EXTENSIONS = [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(env.maxDocumentSize, env.maxImageSize), files: env.maxBatchUploadFiles },
});

/**
 * 폴더/파일 일괄 업로드 (PRD 18~20절).
 * 프론트엔드는 <input type="file" webkitdirectory> 또는 다중 파일 선택으로 얻은 File 목록을
 * FormData의 'files' 필드로 순서대로 append하고, 각 파일의 상대경로(webkitRelativePath, 폴더
 * 업로드가 아니면 null)를 같은 순서의 JSON 배열로 'pathsJson' 필드에 담아 함께 보낸다.
 * 브라우저가 사용자 컴퓨터를 임의로 탐색하지 않고, 사용자가 명시적으로 선택한 파일만 받는다.
 */
adminUploadsRouter.post("/", upload.array("files", env.maxBatchUploadFiles), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "업로드할 파일이 없습니다." });

  const uploadName = typeof req.body?.uploadName === "string" && req.body.uploadName.trim()
    ? req.body.uploadName.trim()
    : `업로드 ${new Date().toLocaleString("ko-KR")}`;
  const sourceType = req.body?.sourceType === "folder" ? "folder" : "files";

  let relativePaths: (string | null)[] = [];
  try {
    const parsed = req.body?.pathsJson ? JSON.parse(req.body.pathsJson) : [];
    if (Array.isArray(parsed)) relativePaths = parsed;
  } catch {
    // pathsJson이 없거나 형식이 잘못되어도 업로드 자체는 계속 진행한다 (파일명만으로도 처리 가능).
  }

  for (const file of files) {
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.originalname))) {
      return res.status(400).json({
        error: `지원하지 않는 파일 형식입니다: ${file.originalname}. 허용 형식: ${ALLOWED_EXTENSIONS.join(", ")}`,
      });
    }
  }

  const { rows: jobRows } = await pool.query(
    `INSERT INTO import_jobs (uploaded_by, upload_name, source_type, file_count, status)
     VALUES ($1,$2,$3,$4,'uploaded') RETURNING *`,
    [req.session.auth!.id, uploadName, sourceType, files.length]
  );
  const job = jobRows[0];

  const savedDocs = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = extensionOf(file.originalname);
    const validationError = validateUploadedFile(file.originalname, file.buffer, ALLOWED_EXTENSIONS);
    if (validationError) {
      await pool.query(
        `INSERT INTO extracted_documents (import_job_id, file_name, relative_path, file_type, storage_path, processing_status, error_message)
         VALUES ($1,$2,$3,$4,'', 'failed', $5)`,
        [job.id, file.originalname, relativePaths[i] ?? null, ext, validationError]
      );
      continue;
    }

    const kind = IMAGE_EXTENSIONS.includes(ext) ? "image" : "agreement";
    const stored = await storeFile(kind, file.buffer, file.originalname);
    const { rows } = await pool.query(
      `INSERT INTO extracted_documents (import_job_id, file_name, relative_path, file_type, storage_path, processing_status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
      [job.id, file.originalname, relativePaths[i] ?? null, stored.fileType, stored.storagePath]
    );
    savedDocs.push(rows[0]);
  }

  res.status(201).json({ job, documentCount: savedDocs.length });
});
