import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../shared/api";
import { categoryLabel, telHref, naverDirectionsUrl, agreementPeriodLabel } from "../shared/formatters";
import MapView from "../shared/MapView";
import { useFavorites } from "../shared/useFavorites";

interface Detail {
  partner: {
    id: number; name: string; category: string; sub_category: string; phone: string | null;
    website: string | null; address: string; latitude: number | null; longitude: number | null;
    description: string | null;
  };
  agreement: {
    main_content: string | null; member_benefit: string | null; family_benefit: string | null;
    usage_condition: string | null; notice: string | null; start_date: string | null; end_date: string | null;
  } | null;
  medical: {
    medical_type: string | null; departments: string[]; consultation_hours: string | null;
    parking_available: boolean | null; health_check_available: boolean; national_health_check: boolean;
    general_health_check: boolean; comprehensive_health_check: boolean; cancer_check: boolean;
    member_health_check: boolean; health_check_benefit: string | null; reservation_method: string | null;
  } | null;
  images: { id: number; is_main: boolean }[];
  files: { id: number; file_name: string; file_type: string }[];
  agreementEffectiveStatus: "active" | "upcoming_renewal" | "ended";
}

const HEALTH_CHECK_LABELS: { key: keyof NonNullable<Detail["medical"]>; label: string }[] = [
  { key: "national_health_check", label: "국가건강검진" },
  { key: "general_health_check", label: "일반건강검진" },
  { key: "comprehensive_health_check", label: "종합건강검진" },
  { key: "cancer_check", label: "암검진" },
  { key: "member_health_check", label: "조합원 건강검진" },
];

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    api.get<Detail>(`/partners/${id}`).then(setData).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) return <p className="p-6 text-center text-slate-400">협약기관을 찾을 수 없습니다.</p>;
  if (!data) return <p className="p-6 text-center text-slate-400">불러오는 중...</p>;

  const { partner, agreement, medical, images, files } = data;
  const fav = isFavorite(partner.id);

  return (
    <div className="pb-8">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-xl">‹</button>
        <p className="font-bold text-slate-900 truncate flex-1">{partner.name}</p>
        <button onClick={() => toggle(partner.id)} className="text-xl">{fav ? "⭐" : "☆"}</button>
      </div>

      {images.length > 0 && (
        <div className="flex overflow-x-auto gap-2 p-3 bg-white">
          {images.map((img) => (
            <img key={img.id} src={`/api/files/image/${img.id}`} className="h-40 w-56 object-cover rounded-xl shrink-0" />
          ))}
        </div>
      )}

      <div className="p-4">
        <p className="text-xs text-slate-400 mb-1">{categoryLabel(partner.category)} / {partner.sub_category}</p>
        <h1 className="text-xl font-bold text-slate-900 mb-4">{partner.name}</h1>

        {agreement?.main_content && (
          <section className="mb-4">
            <h2 className="font-bold text-slate-900 mb-1">협약내용</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{agreement.main_content}</p>
          </section>
        )}

        {agreement?.member_benefit && (
          <section className="bg-brand-900 text-white rounded-2xl p-5 mb-4">
            <p className="font-bold mb-2">🎁 조합원 특별혜택</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{agreement.member_benefit}</p>
            {agreement.family_benefit && <p className="text-sm mt-2 text-brand-100">👪 {agreement.family_benefit}</p>}
          </section>
        )}

        <section className="mb-4">
          <p className="text-sm text-slate-700">📍 {partner.address}</p>
          <div className="mt-2">
            <MapView
              markers={[{ id: partner.id, lat: partner.latitude, lng: partner.longitude, title: partner.name }]}
              fallbackAddress={partner.address}
              showCurrentLocation
            />
          </div>
          {partner.latitude && partner.longitude && (
            <a href={naverDirectionsUrl(partner.latitude, partner.longitude, partner.name)} target="_blank" rel="noreferrer"
              className="block text-center mt-2 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
              🧭 길찾기
            </a>
          )}
        </section>

        {partner.phone && (
          <a href={telHref(partner.phone)} className="block text-center rounded-xl bg-brand-900 text-white py-3 text-sm font-bold mb-4">
            📞 전화하기 ({partner.phone})
          </a>
        )}

        {partner.website && (
          <a href={partner.website} target="_blank" rel="noreferrer"
            className="block text-center rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 mb-4">
            🌐 홈페이지 방문하기
          </a>
        )}

        {/* 협약기간은 협약 주요내용 유무와 무관하게 항상 표시한다 (2026-08-14 — 레거시 자료 import분은
            협약 주요내용이 비어있는 경우가 많아, 이전에는 이 조건에 묶여 협약기간도 함께 안 보였다). */}
        {(agreement?.start_date || agreement?.end_date) && (
          <p className="text-xs text-slate-400 mb-4">📅 협약기간: {agreementPeriodLabel(agreement!.start_date, agreement!.end_date)}</p>
        )}

        {agreement?.usage_condition && (
          <section className="mb-4">
            <h2 className="font-bold text-slate-900 mb-1">이용조건</h2>
            <p className="text-sm text-slate-600">{agreement.usage_condition}</p>
            {agreement.notice && <p className="text-xs text-slate-400 mt-1">유의사항: {agreement.notice}</p>}
          </section>
        )}

        {medical && (
          <section className="mb-4 bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="font-bold text-slate-900 mb-2">진료 정보</h2>
            {medical.departments.length > 0 && <p className="text-sm text-slate-600 mb-1">진료과목: {medical.departments.join(", ")}</p>}
            {medical.consultation_hours && <p className="text-sm text-slate-600 mb-1">진료시간: {medical.consultation_hours}</p>}
            {medical.parking_available != null && <p className="text-sm text-slate-600 mb-2">주차: {medical.parking_available ? "가능" : "불가"}</p>}

            <h3 className="font-bold text-slate-900 mt-3 mb-1">건강검진</h3>
            <p className="text-sm mb-1">{medical.health_check_available ? "가능" : "불가"}</p>
            {medical.health_check_available && (
              <ul className="text-sm text-slate-600 space-y-0.5 mb-2">
                {HEALTH_CHECK_LABELS.filter((h) => medical[h.key]).map((h) => <li key={h.key}>✅ {h.label}</li>)}
              </ul>
            )}
            {medical.health_check_benefit && <p className="text-sm text-slate-600">할인혜택: {medical.health_check_benefit}</p>}
            {medical.reservation_method && <p className="text-sm text-slate-600">예약방법: {medical.reservation_method}</p>}
          </section>
        )}

        {files.length > 0 && (
          <section className="mb-4">
            <h2 className="font-bold text-slate-900 mb-2">협약서</h2>
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={`/api/files/agreement/${f.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-700">
                    📄 {f.file_name} <span>보기 ›</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
          협약 혜택 이용 시 아산시공무원노동조합 <b>모바일회원증</b>을 제시해주세요. (본 서비스는 모바일회원증 앱과 별도로 운영됩니다.)
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          ※ 제휴협약에 따른 혜택내용은 일부 변경될 수 있으니, 혜택내용을 미리 확인 후 이용해주시면 감사하겠습니다.
          (변경 또는 최신 내용은 새올 '아공노조' 게시판 및 각 업체에 문의) 기타 제휴협약과 관련한 문의사항은
          노조사무실(2667)로 연락주시기 바랍니다.
        </p>

        <Link to="/" className="block text-center mt-4 text-sm text-slate-400">홈으로</Link>
      </div>
    </div>
  );
}
