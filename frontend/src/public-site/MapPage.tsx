import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../shared/api";
import MapView, { categoryLegend } from "../shared/MapView";
import { CATEGORIES } from "../shared/categories";

interface PartnerRow { id: number; name: string; category: string; latitude: number | null; longitude: number | null; }

export default function MapPage() {
  const [items, setItems] = useState<PartnerRow[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ items: PartnerRow[] }>("/partners?pageSize=100").then((d) => setItems(d.items));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-slate-900 mb-3">전체 협약기관 지도</h1>
      <MapView
        markers={items.map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude, title: p.name, category: p.category }))}
        onMarkerClick={(id) => navigate(`/partners/${id}`)}
        height="60vh"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {categoryLegend(CATEGORIES.map((c) => c.code)).map((c) => (
          <span key={c.code} className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3">기관이 많아지면 지도 확대 시 자동으로 묶어 보여주는 클러스터링은 2차 개발 항목입니다 (README 참고).</p>
    </div>
  );
}
