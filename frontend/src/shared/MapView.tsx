import { useEffect, useRef, useState } from "react";
import { loadNaverMaps, isNaverMapsConfigured, ASAN_CITY_HALL } from "./naverMaps";
import { categoryLabel } from "./formatters";

export interface MapMarkerData {
  id: number;
  lat: number | null;
  lng: number | null;
  title: string;
  category?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const CATEGORY_MARKER_COLORS: Record<string, string> = {
  medical: "#2563eb", restaurant: "#ea580c", marriage: "#db2777", automobile: "#4b5563",
  telecom: "#059669", living: "#ca8a04", coffee_bakery: "#92400e", etc: "#64748b",
  custom_11: "#475569", education: "#0891b2", hotspring: "#0d9488",
};

interface Props {
  markers: MapMarkerData[];
  height?: string;
  zoom?: number;
  onMarkerClick?: (id: number) => void;
  showCurrentLocation?: boolean;
  fallbackAddress?: string;
}

/**
 * NAVER Maps 임베드. 클라이언트 ID(VITE_NAVER_MAP_CLIENT_ID)가 없는 개발환경에서는 인터랙티브
 * 지도 대신 안내 패널 + 외부 네이버지도 링크로 대체한다 (PRD 46절: 키 없이도 UI를 테스트할 수 있어야 함).
 */
export default function MapView({ markers, height = "240px", zoom = 15, onMarkerClick, showCurrentLocation, fallbackAddress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const validMarkers = markers.filter((m) => m.lat != null && m.lng != null);

  useEffect(() => {
    if (!isNaverMapsConfigured || !containerRef.current) return;
    let map: any;
    let cancelled = false;

    loadNaverMaps()
      .then((naver) => {
        if (cancelled || !containerRef.current) return;
        const center = validMarkers[0]
          ? new naver.maps.LatLng(validMarkers[0].lat, validMarkers[0].lng)
          : new naver.maps.LatLng(ASAN_CITY_HALL.lat, ASAN_CITY_HALL.lng);
        map = new naver.maps.Map(containerRef.current, { center, zoom });

        validMarkers.forEach((m) => {
          const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(m.lat, m.lng),
            map,
            title: m.title,
            // 기관명을 동그라미 옆에 항상 표시한다 (2026-08-18 요청 — 처음엔 hover로 했다가 "계속
            // 보이게"로 변경). 네이버 지도 자체 장소명 라벨과 비슷한 글자 크기. 대분류 마커는 그
            // 카테고리 색으로, 상세페이지처럼 마커 하나만 단독으로 찍히는 경우(카테고리 정보 없음)는
            // 빨간색으로 표시한다 (2026-08-18 추가 요청).
            icon: (() => {
              const color = m.category ? CATEGORY_MARKER_COLORS[m.category] ?? "#334155" : "#dc2626";
              return {
                content: `
                  <div style="position:relative;">
                    <div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,.4);cursor:pointer;"></div>
                    <div id="marker-label-${m.id}" class="marker-label" style="position:absolute;top:-3px;left:19px;white-space:nowrap;color:${color};font-size:12px;font-weight:600;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;cursor:pointer;">${escapeHtml(m.title)}</div>
                  </div>
                `,
                anchor: new naver.maps.Point(7, 7),
              };
            })(),
          });
          if (onMarkerClick) {
            naver.maps.Event.addListener(marker, "click", () => onMarkerClick(m.id));
            // 라벨(기관명 글자)이 지도 마커 아이콘의 원래 영역 밖으로 튀어나와 있어, 네이버 지도가
            // 인식하는 마커 클릭 판정 영역에 라벨 부분은 포함되지 않는 걸 실제로 확인했다
            // (2026-08-18 — 라벨을 클릭해도 상세페이지로 이동하지 않는 버그). 라벨 DOM에 별도로
            // 직접 클릭 리스너를 붙여 보완한다.
            const labelEl = document.getElementById(`marker-label-${m.id}`);
            labelEl?.addEventListener("click", () => onMarkerClick(m.id));
          }
        });

        if (showCurrentLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            if (cancelled) return;
            new naver.maps.Marker({
              position: new naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude),
              map,
              icon: {
                content: `<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,.5)"></div>`,
                anchor: new naver.maps.Point(8, 8),
              },
            });
          });
        }
      })
      .catch((err) => setError(err.message));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(validMarkers.map((m) => [m.id, m.lat, m.lng]))]);

  if (!isNaverMapsConfigured || error) {
    return (
      <div
        style={{ height }}
        className="rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center gap-2 p-4 text-center"
      >
        <p className="text-sm text-slate-500">
          {error ? "지도를 불러오지 못했습니다." : "지도 미리보기를 사용하려면 NAVER Maps API 키 설정이 필요합니다."}
        </p>
        {fallbackAddress && (
          <a
            href={`https://map.naver.com/p/search/${encodeURIComponent(fallbackAddress)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-brand-600 underline"
          >
            네이버 지도에서 "{fallbackAddress}" 검색
          </a>
        )}
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className="rounded-xl overflow-hidden border border-slate-200" />;
}

export function categoryLegend(codes: string[]) {
  return codes.map((code) => ({ code, label: categoryLabel(code), color: CATEGORY_MARKER_COLORS[code] ?? "#334155" }));
}
