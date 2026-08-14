import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { env } from "../config/env";

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  // 협약서/이미지/엑셀/폴더 업로드가 용량 제한을 넘으면 multer가 던지는 오류.
  // 그대로 두면 원인을 알 수 없는 500으로 처리되므로 사람이 읽을 수 있는 메시지로 바꾼다 (PRD 42-24).
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const mb = Math.round(env.maxDocumentSize / (1024 * 1024));
      return res.status(413).json({ error: `파일 용량이 너무 큽니다 (${mb}MB 이하만 업로드 가능합니다).` });
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(413).json({ error: `한 번에 업로드할 수 있는 파일 개수(${env.maxBatchUploadFiles}개)를 초과했습니다.` });
    }
    return res.status(400).json({ error: `파일 업로드 오류: ${err.message}` });
  }

  // express.json()이 잘못된 JSON 본문을 받으면 SyntaxError(status 400)를 던진다.
  const maybeHttpError = err as { status?: number; statusCode?: number; type?: string };
  if (maybeHttpError?.status === 400 || maybeHttpError?.statusCode === 400 || maybeHttpError?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "요청 형식이 올바르지 않습니다." });
  }

  console.error("[unhandled error]", err);
  return res.status(500).json({ error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "요청한 리소스를 찾을 수 없습니다." });
}
