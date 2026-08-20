/**
 * 1회성: 원본 엑셀(아공노 제휴협약 현황 20250515, 개별 기관 시트에 스캔 이미지로 첨부된 협약서)
 * 에서 기관별 이미지를 추출해 PDF로 합친 뒤 R2에 업로드하고 agreement_files에 등록한다
 * (2026-08-20 사용자 요청 — "협약서는 엑셀파일에 링크로 되어있는데, 이것도 사전에 업로드 가능하게").
 *
 * 사용법:
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=... \
 *   npx tsx src/db/upload-agreement-docs.ts <DATABASE_URL> <미디어폴더경로> <final-map.json경로>
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const dbUrl = process.argv[2];
const mediaDir = process.argv[3];
const mapPath = process.argv[4];
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!dbUrl || !mediaDir || !mapPath || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("사용법: R2_* 환경변수 + npx tsx upload-agreement-docs.ts <DATABASE_URL> <미디어폴더> <final-map.json>");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

interface MapEntry {
  partnerName: string;
  sheetName: string;
  images: string[];
}

async function buildPdf(imagePaths: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (const imgPath of imagePaths) {
    // JPG를 그대로 임베드하되, 너무 큰 원본은 페이지 크기에 맞춘다 (A4 비율 기준 최대 1600px 폭).
    const resized = await sharp(imgPath).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const meta = await sharp(resized).metadata();
    const jpgImage = await pdf.embedJpg(resized);
    const page = pdf.addPage([meta.width ?? 1600, meta.height ?? 2000]);
    page.drawImage(jpgImage, { x: 0, y: 0, width: meta.width ?? 1600, height: meta.height ?? 2000 });
  }
  return Buffer.from(await pdf.save());
}

async function run() {
  const entries: MapEntry[] = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
  const { rows: partners } = await pool.query(`SELECT id, name FROM partners`);
  const byName = new Map(partners.map((p) => [p.name.trim(), p.id]));

  let uploaded = 0;
  let notFound = 0;
  const notFoundNames: string[] = [];

  for (const entry of entries) {
    const partnerId = byName.get(entry.partnerName.trim());
    if (!partnerId) {
      notFound++;
      notFoundNames.push(entry.partnerName);
      continue;
    }

    const imagePaths = entry.images.map((f) => path.join(mediaDir, f));
    const missing = imagePaths.filter((p) => !fs.existsSync(p));
    if (missing.length > 0) {
      console.log(`⚠️  [${entry.partnerName}] 이미지 파일 없음: ${missing.join(", ")}`);
      continue;
    }

    try {
      const pdfBuffer = await buildPdf(imagePaths);
      const key = `agreement-files/${crypto.randomBytes(16).toString("hex")}.pdf`;
      await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: pdfBuffer, ContentType: "application/pdf" }));

      await pool.query(
        `INSERT INTO agreement_files (partner_id, file_name, file_path, file_type, storage_provider, is_public, uploaded_at)
         VALUES ($1, $2, $3, 'pdf', 'r2', true, now())`,
        [partnerId, `${entry.partnerName}_협약서.pdf`, key]
      );
      uploaded++;
      console.log(`✅ [${entry.partnerName}] (id ${partnerId}) — 협약서 업로드 완료 (이미지 ${entry.images.length}장)`);
    } catch (err) {
      console.error(`❌ [${entry.partnerName}] 처리 실패:`, err);
    }
  }

  console.log(`\n===== 결과 =====`);
  console.log(`업로드: ${uploaded}건 / DB 매칭 실패: ${notFound}건`);
  if (notFoundNames.length > 0) {
    console.log(`매칭 안 된 이름:`, notFoundNames);
  }
}

run()
  .catch((err) => {
    console.error("실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
