import path from "path";

/**
 * 확장자 화이트리스트 + 매직바이트(파일 시그니처) 검증.
 * 확장자만 바꿔서 위험한 파일을 올리는 것을 막기 위한 최소한의 방어선이다 (PRD 33절 파일 보안).
 * HWP(구버전)/TXT/CSV처럼 신뢰할 만한 공용 매직바이트가 없는 형식은 확장자 검사만 수행한다.
 */

export const DOCUMENT_EXTENSIONS = ["pdf", "hwp", "hwpx", "docx", "txt", "xlsx", "xls", "csv"];
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

const SIGNATURES: Record<string, Buffer[]> = {
  pdf: [Buffer.from("25504446", "hex")], // %PDF
  png: [Buffer.from("89504e470d0a1a0a", "hex")],
  jpg: [Buffer.from("ffd8ff", "hex")],
  jpeg: [Buffer.from("ffd8ff", "hex")],
  webp: [Buffer.from("52494646", "hex")], // RIFF (WEBP는 뒤에 WEBP 태그가 더 붙음, 앞 4바이트만 확인)
  // OOXML/HWPX는 ZIP 컨테이너이므로 PK 시그니처를 확인한다.
  docx: [Buffer.from("504b0304", "hex")],
  xlsx: [Buffer.from("504b0304", "hex")],
  hwpx: [Buffer.from("504b0304", "hex")],
  // 구버전 HWP(바이너리)는 OLE 컴파운드 파일 포맷을 사용한다.
  hwp: [Buffer.from("d0cf11e0a1b11ae1", "hex")],
};

export function extensionOf(fileName: string): string {
  return path.extname(fileName).replace(".", "").toLowerCase();
}

export function isAllowedExtension(fileName: string, allowed: string[]): boolean {
  return allowed.includes(extensionOf(fileName));
}

export function matchesSignature(buffer: Buffer, ext: string): boolean {
  const sigs = SIGNATURES[ext];
  if (!sigs) return true; // 검증 가능한 시그니처가 없는 형식(txt, csv, xls, hwp 구버전 변형 등)은 통과시킨다
  return sigs.some((sig) => buffer.subarray(0, sig.length).equals(sig));
}

export function validateUploadedFile(fileName: string, buffer: Buffer, allowedExtensions: string[]): string | null {
  const ext = extensionOf(fileName);
  if (!allowedExtensions.includes(ext)) {
    return `지원하지 않는 파일 형식입니다 (${ext || "확장자 없음"}). 허용 형식: ${allowedExtensions.join(", ")}`;
  }
  if (!matchesSignature(buffer, ext)) {
    return `파일 내용이 확장자(${ext})와 일치하지 않습니다. 파일이 손상되었거나 형식이 올바르지 않습니다.`;
  }
  return null;
}
