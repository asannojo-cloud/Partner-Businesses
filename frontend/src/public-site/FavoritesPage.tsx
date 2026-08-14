import { useEffect, useState } from "react";
import { api } from "../shared/api";
import { useFavorites } from "../shared/useFavorites";
import PartnerCard, { type PartnerCardData } from "../shared/PartnerCard";

export default function FavoritesPage() {
  const { favoriteIds } = useFavorites();
  const [all, setAll] = useState<PartnerCardData[]>([]);

  useEffect(() => {
    api.get<{ items: PartnerCardData[] }>("/partners?pageSize=100").then((d) => setAll(d.items));
  }, []);

  const items = all.filter((p) => favoriteIds.includes(p.id));

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-slate-900 mb-3">⭐ 즐겨찾기</h1>
      {items.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-16">즐겨찾기한 협약기관이 없습니다.<br />기관 상세페이지에서 ☆를 눌러 추가해보세요.</p>
      ) : (
        <div className="space-y-3">
          {items.map((p) => <PartnerCard key={p.id} partner={p} />)}
        </div>
      )}
    </div>
  );
}
