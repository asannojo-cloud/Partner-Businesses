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

// 스크립트 태그의 onload는 "파일 다운로드·실행 완료"만 보장하고, NAVER SDK가 내부적으로 추가
// 로드하는 스타일 정의(비동기)까지 끝나야 naver.maps.Map 생성자가 실제로 준비된다. onload 직후
// 바로 new naver.maps.Map()을 호출하면 간헐적으로 "생성자가 아닙니다" 오류가 나서 지도가 잠깐
// 나타났다 오류 화면으로 바뀌는 문제가 있었다 (2026-08-14 실제 발견) — Map 생성자가 실제로
// 정의될 때까지 짧게 폴링해서 기다린다.
function waitForMapConstructor(timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (window.naver?.maps?.Map) return resolve(window.naver);
      if (Date.now() - start > timeoutMs) return reject(new Error("네이버 지도 초기화 시간이 초과되었습니다."));
      setTimeout(poll, 100);
    })();
  });
}

export function loadNaverMaps(): Promise<any> {
  if (!NAVER_MAP_CLIENT_ID) {
    return Promise.reject(new Error("NAVER_MAP_CLIENT_ID가 설정되지 않았습니다."));
  }
  if (window.naver?.maps?.Map) return Promise.resolve(window.naver);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-naver-maps="1"]');
    if (existing) {
      waitForMapConstructor().then(resolve, reject);
      return;
    }
    const script = document.createElement("script");
    // NAVER가 2024년에 NCP Maps 인증 파라미터를 ncpClientId → ncpKeyId로 변경했다. 콘솔에서
    // 발급받은 시점/유형에 따라 어느 쪽을 요구하는지 달라 "인증이 실패하였습니다" 오류가
    // 간헐적으로 발생했다 (2026-08-14 실제 발견) — 두 파라미터를 함께 보내 어느 쪽이든 인식되게 한다.
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_MAP_CLIENT_ID}&ncpKeyId=${NAVER_MAP_CLIENT_ID}`;
    script.async = true;
    script.dataset.naverMaps = "1";
    script.onload = () => waitForMapConstructor().then(resolve, reject);
    script.onerror = () => reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export const ASAN_CITY_HALL = { lat: 36.7898, lng: 127.0019 };
