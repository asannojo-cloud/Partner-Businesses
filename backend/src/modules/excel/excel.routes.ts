import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env";
import { adminGuard } from "../../middleware/guards";
import { buildTemplateWorkbook, directImportWorkbook } from "./excel.service";

export const adminExcelRouter = Router();
adminExcelRouter.use(adminGuard);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxExcelSize } });

adminExcelRouter.get("/template", (req, res) => {
  const buffer = buildTemplateWorkbook();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  // 한글 파일명을 Content-Disposition에 그대로 넣으면 Node가 ERR_INVALID_CHAR로 500을 낸다
  // (HTTP 헤더는 기본적으로 ASCII만 허용) — RFC 5987 filename*=UTF-8'' 형식으로 인코딩해야 한다
  // (2026-08-14 실제 발견 — "업로드 양식 다운로드" 클릭 시 오류).
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="agreement-template.xlsx"; filename*=UTF-8''${encodeURIComponent("협약기관_업로드양식.xlsx")}`
  );
  res.send(buffer);
});

// 검토/승인 단계 없이 업로드 즉시 반영한다 (2026-08-14 — 협약기관 관리 화면에서 바로 사용).
adminExcelRouter.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "업로드할 Excel 파일이 없습니다." });
  const ext = req.file.originalname.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
    return res.status(400).json({ error: "xlsx, xls, csv 파일만 업로드할 수 있습니다." });
  }

  let result;
  try {
    result = await directImportWorkbook(req.file.buffer, req.session.auth!.id);
  } catch (err) {
    return res.status(400).json({ error: "Excel 파일을 읽을 수 없습니다. 양식을 확인해주세요." });
  }
  res.status(201).json(result);
});
