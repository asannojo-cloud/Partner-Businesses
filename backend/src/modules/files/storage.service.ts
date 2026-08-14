import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../../config/env";

/**
 * 협약서/기관이미지 파일 저장 추상화.
 * R2(4개 env 값 전부 설정)가 있으면 R2에, 없으면 로컬 디스크(웹루트 밖 storage/)에 저장한다.
 * (자매 프로젝트 photos.service.ts의 로컬↔R2 폴백 패턴과 동일한 방식)
 */

export type FileKind = "agreement" | "image";
export type StorageProvider = "local" | "r2";

function localDirFor(kind: FileKind): string {
  return kind === "agreement" ? env.agreementFilesDir : env.partnerImagesDir;
}

function r2PrefixFor(kind: FileKind): string {
  return kind === "agreement" ? "agreement-files" : "partner-images";
}

let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2.accessKeyId!,
        secretAccessKey: env.r2.secretAccessKey!,
      },
    });
  }
  return s3Client;
}

export function ensureStorageDirs() {
  for (const dir of [env.agreementFilesDir, env.partnerImagesDir, env.uploadTmpDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = crypto.randomBytes(16).toString("hex");
  return `${base}${ext}`;
}

export interface StoredFile {
  storagePath: string; // 로컬: storage 디렉터리 기준 상대경로 / R2: object key
  storageProvider: StorageProvider;
  fileType: string; // 확장자 (점 제외, 소문자)
}

export async function storeFile(kind: FileKind, buffer: Buffer, originalName: string): Promise<StoredFile> {
  const fileName = safeFileName(originalName);
  const fileType = path.extname(originalName).replace(".", "").toLowerCase();

  if (env.isR2Configured) {
    const key = `${r2PrefixFor(kind)}/${fileName}`;
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.r2.bucketName!,
        Key: key,
        Body: buffer,
      })
    );
    return { storagePath: key, storageProvider: "r2", fileType };
  }

  const dir = localDirFor(kind);
  fs.mkdirSync(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, fileName), buffer);
  return { storagePath: fileName, storageProvider: "local", fileType };
}

export async function readFile(kind: FileKind, storagePath: string, storageProvider: StorageProvider): Promise<Buffer> {
  if (storageProvider === "r2") {
    const res = await getS3Client().send(
      new GetObjectCommand({ Bucket: env.r2.bucketName!, Key: storagePath })
    );
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return fsp.readFile(path.join(localDirFor(kind), storagePath));
}

export async function deleteFile(kind: FileKind, storagePath: string, storageProvider: StorageProvider): Promise<void> {
  if (storageProvider === "r2") {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: env.r2.bucketName!, Key: storagePath }));
    return;
  }
  const filePath = path.join(localDirFor(kind), storagePath);
  await fsp.rm(filePath, { force: true });
}
