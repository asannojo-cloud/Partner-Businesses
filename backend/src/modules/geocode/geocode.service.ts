import crypto from "crypto";
import { env, isGeocodeMockMode } from "../../config/env";

export interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  status: "ok" | "failed";
}

const ASAN_CITY_HALL = { lat: 36.7898, lng: 127.0019 };

/**
 * 개발환경 mock 지오코더 — NCP 키 없이도 지도 UI를 테스트할 수 있도록 아산시청 인근에
 * 주소 문자열 해시 기반의 결정론적 좌표를 생성한다 (PRD 27절: 실패 시 "주소를 확인해주세요").
 * 너무 짧은 주소(5자 미만)는 항상 실패로 처리해 실패 케이스도 테스트 가능하게 한다.
 */
function mockGeocode(address: string): GeocodeResult {
  const trimmed = address.trim();
  if (trimmed.length < 5) {
    return { latitude: null, longitude: null, status: "failed" };
  }
  const hash = crypto.createHash("md5").update(trimmed).digest();
  const latOffset = ((hash.readUInt16BE(0) / 65535) - 0.5) * 0.06; // 약 ±3km
  const lngOffset = ((hash.readUInt16BE(2) / 65535) - 0.5) * 0.06;
  return {
    latitude: ASAN_CITY_HALL.lat + latOffset,
    longitude: ASAN_CITY_HALL.lng + lngOffset,
    status: "ok",
  };
}

async function naverGeocode(address: string): Promise<GeocodeResult> {
  // NCP가 API 게이트웨이 도메인을 옛 "AI NAVER API"용 naveropenapi.apigw.ntruss.com에서
  // 새 "Maps" 상품용 maps.apigw.ntruss.com으로 옮겼다 — 옛 도메인으로 호출하면 실제 키가 맞아도
  // 401 "구독이 필요합니다"로 거부된다는 걸 실제로 확인했다 (2026-08-20 실제 발견 — 빕스 등
  // 일부 기관 좌표가 부정확했던 근본 원인).
  const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": env.naverClientId!,
        "X-NCP-APIGW-API-KEY": env.naverClientSecret!,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[geocode] NAVER API 오류: ${res.status} ${body}`);
      return { latitude: null, longitude: null, status: "failed" };
    }
    const data = (await res.json()) as { addresses?: Array<{ x: string; y: string }> };
    const first = data.addresses?.[0];
    if (!first) return { latitude: null, longitude: null, status: "failed" };
    return { latitude: parseFloat(first.y), longitude: parseFloat(first.x), status: "ok" };
  } catch (err) {
    console.error("[geocode] NAVER API 호출 실패:", err);
    return { latitude: null, longitude: null, status: "failed" };
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!address || !address.trim()) {
    return { latitude: null, longitude: null, status: "failed" };
  }
  if (isGeocodeMockMode()) {
    return mockGeocode(address);
  }
  return naverGeocode(address);
}
