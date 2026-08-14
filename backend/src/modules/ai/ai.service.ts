import path from "path";
import { pool } from "../../db/pool";
import { isAiMockMode } from "../../config/env";
import { extractText, isImageFile } from "./textExtraction";
import { mockExtract } from "./mockExtractor";
import { extractWithClaude } from "./anthropicClient";
import { findDuplicate } from "../duplicates/duplicates.service";
import { readFile } from "../files/storage.service";
import { DocumentGroupInput, PartnerCandidate } from "./ai.types";
import { isValidCategory, isValidSubCategory } from "../../shared/categories";
import { geocodeAddress } from "../geocode/geocode.service";
import { refreshPartnerCacheFlags } from "../partners/partners.service";

interface DocRow {
  id: number;
  file_name: string;
  relative_path: string | null;
  file_type: string;
  storage_path: string;
  extracted_text: string | null;
  processing_status: string;
}

function groupKeyFor(doc: DocRow): string {
  if (doc.relative_path) {
    const dir = path.posix.dirname(doc.relative_path.replace(/\\/g, "/"));
    if (dir && dir !== ".") return dir;
  }
  return doc.file_name.replace(/\.[^.]+$/, "");
}

const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};

/** 1단계: 아직 텍스트 추출을 하지 않은 문서들의 본문을 추출해 DB에 저장한다. */
async function ensureDocumentsExtracted(jobId: number) {
  const { rows } = await pool.query<DocRow>(
    `SELECT id, file_name, relative_path, file_type, storage_path, extracted_text, processing_status
     FROM extracted_documents WHERE import_job_id = $1 AND processing_status = 'pending'`,
    [jobId]
  );
  for (const doc of rows) {
    try {
      const kind = isImageFile(doc.file_type) ? "image" : "agreement";
      const buffer = await readFile(kind, doc.storage_path, "local").catch(() =>
        readFile(kind, doc.storage_path, "r2")
      );
      const result = await extractText(doc.file_type, buffer);
      await pool.query(
        `UPDATE extracted_documents SET extracted_text = $1, processing_status = $2, error_message = $3 WHERE id = $4`,
        [result.text, result.status, result.errorMessage ?? null, doc.id]
      );
    } catch (err) {
      await pool.query(
        `UPDATE extracted_documents SET processing_status = 'failed', error_message = $1 WHERE id = $2`,
        [String(err), doc.id]
      );
    }
  }
}

/** 2단계: 폴더(또는 파일) 단위로 문서를 그룹핑해 기관 후보 단위를 구성한다 (PRD 20절). */
async function buildGroups(jobId: number): Promise<DocumentGroupInput[]> {
  const { rows } = await pool.query<DocRow>(
    `SELECT id, file_name, relative_path, file_type, storage_path, extracted_text, processing_status
     FROM extracted_documents WHERE import_job_id = $1`,
    [jobId]
  );

  const groups = new Map<string, DocRow[]>();
  for (const doc of rows) {
    const key = groupKeyFor(doc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(doc);
  }

  return Array.from(groups.entries()).map(([groupKey, docs]) => ({
    groupKey,
    documentIds: docs.map((d) => d.id),
    imageDocumentIds: docs.filter((d) => isImageFile(d.file_type)).map((d) => d.id),
    fileNames: docs.map((d) => d.file_name),
    combinedText: docs.map((d) => (d.extracted_text ? `[${d.file_name}]\n${d.extracted_text}` : "")).filter(Boolean).join("\n\n"),
    folderHints: groupKey.split("/").filter(Boolean),
  }));
}

async function loadGroupImages(group: DocumentGroupInput): Promise<{ base64: string; mediaType: string }[]> {
  const { rows } = await pool.query<DocRow>(
    `SELECT id, file_name, relative_path, file_type, storage_path, extracted_text, processing_status
     FROM extracted_documents WHERE id = ANY($1)`,
    [group.imageDocumentIds]
  );
  const out: { base64: string; mediaType: string }[] = [];
  for (const doc of rows.slice(0, 5)) {
    try {
      const buffer = await readFile("image", doc.storage_path, "local").catch(() => readFile("image", doc.storage_path, "r2"));
      out.push({ base64: buffer.toString("base64"), mediaType: MEDIA_TYPES[doc.file_type.toLowerCase()] ?? "image/jpeg" });
    } catch {
      // 이미지 로딩 실패는 분석 자체를 막지 않는다 — 해당 이미지만 건너뛴다.
    }
  }
  return out;
}

function sanitizeCandidate(raw: PartnerCandidate): PartnerCandidate {
  const category = raw.category && isValidCategory(raw.category) ? raw.category : null;
  const subCategory = category && raw.subCategory && isValidSubCategory(category, raw.subCategory) ? raw.subCategory : null;
  return { ...raw, category, subCategory };
}

export async function analyzeImportJob(jobId: number) {
  await pool.query(`UPDATE import_jobs SET status = 'analyzing' WHERE id = $1`, [jobId]);
  try {
    await ensureDocumentsExtracted(jobId);
    const groups = await buildGroups(jobId);
    const mock = isAiMockMode();

    for (const group of groups) {
      let candidate: PartnerCandidate;
      try {
        if (mock) {
          candidate = mockExtract(group);
        } else {
          const images = await loadGroupImages(group);
          candidate = await extractWithClaude(group, images);
        }
      } catch (err) {
        console.error(`[ai] Claude 분석 실패 (group=${group.groupKey}), mock으로 대체:`, err);
        candidate = mockExtract(group);
        candidate.notice = `[자동] AI 분석 중 오류가 발생해 임시 추출 결과로 대체되었습니다. 반드시 내용을 확인해주세요. (${String(err).slice(0, 200)})`;
      }
      candidate = sanitizeCandidate(candidate);

      const duplicate = candidate.partnerName ? await findDuplicate(candidate.partnerName, candidate.address ?? "") : null;

      await pool.query(
        `INSERT INTO ai_extracted_partners
           (import_job_id, source_document_ids, candidate_image_document_ids, partner_name, category, sub_category,
            phone, website, address, agreement_date, start_date, end_date, main_content, member_benefit,
            family_benefit, usage_condition, notice, health_check_available, health_check_types, departments,
            field_confidence, duplicate_partner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          jobId, group.documentIds, group.imageDocumentIds, candidate.partnerName, candidate.category,
          candidate.subCategory, candidate.phone, candidate.website, candidate.address, candidate.agreementDate,
          candidate.startDate, candidate.endDate, candidate.mainContent, candidate.memberBenefit,
          candidate.familyBenefit, candidate.usageCondition, candidate.notice, candidate.healthCheckAvailable,
          candidate.healthCheckTypes, candidate.departments, JSON.stringify(candidate.fieldConfidence),
          duplicate?.partnerId ?? null,
        ]
      );
    }

    await pool.query(`UPDATE import_jobs SET status = 'review_ready' WHERE id = $1`, [jobId]);
  } catch (err) {
    await pool.query(`UPDATE import_jobs SET status = 'failed', error_message = $1 WHERE id = $2`, [String(err), jobId]);
    throw err;
  }
}

/** 검토 승인: ai_extracted_partners → partners/agreements/medical_info 생성, 원본 파일 연결 (PRD 23, 28절). */
export async function approveCandidate(candidateId: number, adminId: number, overrides: Partial<PartnerCandidate> & { status?: string }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT * FROM ai_extracted_partners WHERE id = $1 FOR UPDATE`, [candidateId]);
    const c = rows[0];
    if (!c) throw new Error("검토 대상을 찾을 수 없습니다.");
    if (c.review_status === "approved") throw new Error("이미 승인된 항목입니다.");

    const name = overrides.partnerName ?? c.partner_name;
    const category = overrides.category ?? c.category;
    const subCategory = overrides.subCategory ?? c.sub_category;
    if (!name) throw new Error("기관명이 없습니다. 승인 전에 입력해주세요.");
    if (!category || !isValidCategory(category)) throw new Error("올바른 대분류를 선택해주세요.");
    if (!subCategory || !isValidSubCategory(category, subCategory)) throw new Error("올바른 세부분류를 선택해주세요.");

    const address = overrides.address ?? c.address ?? "";
    const geo = await geocodeAddress(address);

    const { rows: partnerRows } = await client.query(
      `INSERT INTO partners (name, category, sub_category, phone, website, address, latitude, longitude, status, geocode_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9) RETURNING id`,
      [name, category, subCategory, overrides.phone ?? c.phone, overrides.website ?? c.website, address,
       geo.latitude, geo.longitude, geo.status]
    );
    const partnerId = partnerRows[0].id;

    await client.query(
      `INSERT INTO agreements (partner_id, agreement_date, start_date, end_date, main_content, member_benefit,
         family_benefit, usage_condition, notice)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        partnerId, overrides.agreementDate ?? c.agreement_date, overrides.startDate ?? c.start_date,
        overrides.endDate ?? c.end_date, overrides.mainContent ?? c.main_content,
        overrides.memberBenefit ?? c.member_benefit, overrides.familyBenefit ?? c.family_benefit,
        overrides.usageCondition ?? c.usage_condition, overrides.notice ?? c.notice,
      ]
    );

    if (category === "medical") {
      const departments = (overrides.departments ?? c.departments ?? "")
        .split(/[,、]/).map((s: string) => s.trim()).filter(Boolean);
      await client.query(
        `INSERT INTO medical_info (partner_id, departments, health_check_available, health_check_benefit, reservation_method)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          partnerId, departments, overrides.healthCheckAvailable ?? c.health_check_available ?? false,
          overrides.healthCheckTypes ?? c.health_check_types, "관리자 확인 필요",
        ]
      );
    }

    // 같은 폴더에서 발견된 이미지 문서를 partner_images로 연결 (파일을 다시 복사하지 않고 같은 storage_path를 재사용).
    if (c.candidate_image_document_ids?.length) {
      const { rows: imgDocs } = await client.query(
        `SELECT storage_path FROM extracted_documents WHERE id = ANY($1)`,
        [c.candidate_image_document_ids]
      );
      for (let i = 0; i < imgDocs.length; i++) {
        const { rows: imgRows } = await client.query(
          `INSERT INTO partner_images (partner_id, file_path, storage_provider, is_main) VALUES ($1,$2,'local',$3) RETURNING id`,
          [partnerId, imgDocs[i].storage_path, i === 0]
        );
        if (i === 0) {
          await client.query(`UPDATE partners SET representative_image_id = $1 WHERE id = $2`, [imgRows[0].id, partnerId]);
        }
      }
    }

    // 원본 협약서(이미지가 아닌 문서)도 agreement_files로 연결 — 기본 비공개(is_public=false), 관리자가 공개 전환.
    const { rows: sourceDocs } = await client.query(
      `SELECT id, file_name, file_type, storage_path FROM extracted_documents WHERE id = ANY($1) AND file_type NOT IN ('jpg','jpeg','png','webp')`,
      [c.source_document_ids]
    );
    for (const doc of sourceDocs) {
      await client.query(
        `INSERT INTO agreement_files (partner_id, file_name, file_path, file_type, storage_provider, uploaded_by)
         VALUES ($1,$2,$3,$4,'local',$5)`,
        [partnerId, doc.file_name, doc.storage_path, doc.file_type, adminId]
      );
    }

    await client.query(
      `UPDATE ai_extracted_partners SET review_status = 'approved', reviewed_by = $1, reviewed_at = now(),
         created_partner_id = $2 WHERE id = $3`,
      [adminId, partnerId, candidateId]
    );

    await client.query("COMMIT");
    await refreshPartnerCacheFlags(partnerId);
    return { partnerId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
