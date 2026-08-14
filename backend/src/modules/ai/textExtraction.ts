import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";

export type ExtractionStatus = "extracted" | "failed" | "unsupported";

export interface ExtractionResult {
  text: string | null;
  status: ExtractionStatus;
  errorMessage?: string;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export function isImageFile(fileType: string): boolean {
  return IMAGE_EXTENSIONS.has(fileType.toLowerCase());
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // pdf-parse는 CommonJS 모듈이라 require로 불러온다 (동적 import 시 진입점 문제 회피).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buffer);
    return { text: result.text?.trim() || null, status: "extracted" };
  } catch (err) {
    return { text: null, status: "failed", errorMessage: String(err) };
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value?.trim() || null, status: "extracted" };
  } catch (err) {
    return { text: null, status: "failed", errorMessage: String(err) };
  }
}

function extractSpreadsheet(buffer: Buffer): ExtractionResult {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      parts.push(`# ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}`);
    }
    return { text: parts.join("\n\n").trim() || null, status: "extracted" };
  } catch (err) {
    return { text: null, status: "failed", errorMessage: String(err) };
  }
}

// HWPX는 ZIP 컨테이너 안에 XML로 본문이 들어있는 최신 한글 문서 형식이다. Contents/section*.xml의
// 텍스트 노드만 모아 최선의 노력(best-effort)으로 추출한다 — 서식/표 구조까지는 재현하지 않는다.
function extractHwpx(buffer: Buffer): ExtractionResult {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((e) => /Contents\/section\d+\.xml$/i.test(e.entryName));
    if (entries.length === 0) {
      return { text: null, status: "failed", errorMessage: "HWPX 본문(section) 파일을 찾을 수 없습니다." };
    }
    const parser = new XMLParser({ ignoreAttributes: true, textNodeName: "#text" });
    const texts: string[] = [];

    function collectText(node: unknown) {
      if (node == null) return;
      if (typeof node === "string" || typeof node === "number") {
        texts.push(String(node));
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(collectText);
        return;
      }
      if (typeof node === "object") {
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          if (key === "#text") texts.push(String(value));
          else collectText(value);
        }
      }
    }

    for (const entry of entries) {
      const xml = entry.getData().toString("utf-8");
      const parsed = parser.parse(xml);
      collectText(parsed);
    }
    const text = texts.join(" ").replace(/\s+/g, " ").trim();
    return { text: text || null, status: text ? "extracted" : "failed" };
  } catch (err) {
    return { text: null, status: "failed", errorMessage: String(err) };
  }
}

export async function extractText(fileType: string, buffer: Buffer): Promise<ExtractionResult> {
  const ext = fileType.toLowerCase();
  if (isImageFile(ext)) {
    // 이미지는 텍스트 추출 대상이 아니라 Claude Vision 입력으로 별도 처리한다.
    return { text: null, status: "extracted" };
  }
  switch (ext) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "xlsx":
    case "xls":
    case "csv":
      return extractSpreadsheet(buffer);
    case "txt":
      return { text: buffer.toString("utf-8").trim() || null, status: "extracted" };
    case "hwpx":
      return extractHwpx(buffer);
    case "hwp":
      // 구버전 HWP(바이너리 포맷)는 신뢰할 만한 오픈소스 파서가 없어 자동 추출을 지원하지 않는다.
      // 파일은 협약서 원본으로는 그대로 보존하되, 관리자가 검토 화면에서 내용을 직접 입력해야 한다.
      return { text: null, status: "unsupported", errorMessage: "HWP(구버전) 파일은 자동 텍스트 추출을 지원하지 않습니다. 내용을 직접 입력해주세요." };
    default:
      return { text: null, status: "unsupported", errorMessage: `지원하지 않는 파일 형식입니다: ${ext}` };
  }
}
