import { Link } from "react-router-dom";
import { categoryLabel } from "./formatters";
import { useFavorites } from "./useFavorites";

export interface PartnerCardData {
  id: number;
  name: string;
  category: string;
  sub_category: string;
  address: string;
  representative_image_id: number | null;
  health_check_available: boolean;
  member_discount: boolean;
  family_available: boolean;
  member_benefit?: string | null;
}

export default function PartnerCard({ partner }: { partner: PartnerCardData }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(partner.id);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex">
      <Link to={`/partners/${partner.id}`} className="w-24 h-24 shrink-0 bg-slate-100">
        {partner.representative_image_id ? (
          <img src={`/api/files/image/${partner.representative_image_id}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">이미지 없음</div>
        )}
      </Link>
      <div className="flex-1 min-w-0 p-3 relative">
        <button
          onClick={() => toggle(partner.id)}
          aria-label="즐겨찾기"
          className="absolute top-2 right-2 text-lg leading-none"
        >
          {fav ? "⭐" : "☆"}
        </button>
        <Link to={`/partners/${partner.id}`} className="block pr-6">
          <p className="font-bold text-slate-900 truncate">{partner.name}</p>
          <p className="text-xs text-slate-400 mb-1">{categoryLabel(partner.category)} / {partner.sub_category}</p>
          <div className="flex flex-wrap gap-1 mb-1">
            {partner.health_check_available && <span className="text-[11px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full">건강검진 가능</span>}
            {partner.member_discount && <span className="text-[11px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full">조합원 할인</span>}
            {partner.family_available && <span className="text-[11px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">가족 이용 가능</span>}
          </div>
          <p className="text-xs text-slate-500 truncate">📍 {partner.address}</p>
        </Link>
      </div>
    </div>
  );
}
