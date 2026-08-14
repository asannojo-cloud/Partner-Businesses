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

export const CATEGORY_MARKER_COLORS: Record<string, string> = {
  medical: "#2563eb", restaurant: "#ea580c", culture: "#7c3aed", education: "#0891b2",
  childcare: "#db2777", automobile: "#4b5563", telecom: "#059669", living: "#ca8a04",
  finance: "#16a34a", etc: "#64748b",
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
            icon: m.category
              ? {
                  content: `<div style="background:${CATEGORY_MARKER_COLORS[m.category] ?? "#334155"};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,.4)"></div>`,
                  anchor: new naver.maps.Point(7, 7),
                }
              : undefined,
          });
          if (onMarkerClick) {
            naver.maps.Event.addListener(marker, "click", () => onMarkerClick(m.id));
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
