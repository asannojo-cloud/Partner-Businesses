/**
 * NAVER Maps JS SDK 동적 로더.
 * PRD 33절: 지도 API 키는 소스코드에 하드코딩하지 않고 빌드타임 공개 환경변수(VITE_NAVER_MAP_CLIENT_ID)로
 * 주입한다 (NAVER Maps는 클라이언트 ID 자체가 도메인 화이트리스트로 보호되는 공개 키라 브라우저에
 * 노출되어도 안전 — secret 키는 서버(geocode API 호출)에만 존재한다).
 */

declare global {
  interface Window {
    naver?: any;
  }
}

export const NAVER_MAP_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined;
export const isNaverMapsConfigured = Boolean(NAVER_MAP_CLIENT_ID);

let loadPromise: Promise<any> | null = null;

export function loadNaverMaps(): Promise<any> {
  if (!NAVER_MAP_CLIENT_ID) {
    return Promise.reject(new Error("NAVER_MAP_CLIENT_ID가 설정되지 않았습니다."));
  }
  if (window.naver?.maps) return Promise.resolve(window.naver);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_MAP_CLIENT_ID}`;
    script.async = true;
    script.onload = () => resolve(window.naver);
    script.onerror = () => reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export const ASAN_CITY_HALL = { lat: 36.7898, lng: 127.0019 };
