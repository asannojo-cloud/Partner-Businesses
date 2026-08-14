import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../shared/api";
import { CATEGORIES } from "../shared/categories";
import MapView from "../shared/MapView";

interface Partner {
  id: number; name: string; category: string; sub_category: string; representative_name: string | null;
  phone: string | null; website: string | null; address: string; detail_address: string | null;
  postal_code: string | null; description: string | null; latitude: number | null; longitude: number | null;
  geocode_status: string; status: string;
}
interface Agreement {
  id: number; agreement_date: string | null; start_date: string | null; end_date: string | null;
  auto_renewal: boolean; main_content: string | null; member_benefit: string | null;
  family_benefit: string | null; usage_condition: string | null; notice: string | null;
}
interface Medical {
  medical_type: string | null; departments: string[]; consultation_hours: string | null;
  parking_available: boolean | null; health_check_available: boolean; national_health_check: boolean;
  general_health_check: boolean; comprehensive_health_check: boolean; cancer_check: boolean;
  member_health_check: boolean; health_check_benefit: string | null; reservation_method: string | null;
}
interface ImageRow { id: number; file_path: string; is_main: boolean; }
interface FileRow { id: number; file_name: string; file_type: string; is_public: boolean; agreement_signed_date: string | null; }

const emptyPartner = {
  name: "", category: "medical", subCategory: CATEGORIES[0].subCategories[0], representativeName: "",
  phone: "", website: "", address: "", detailAddress: "", postalCode: "", description: "",
};

export default function PartnerFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyPartner);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [agreementForm, setAgreementForm] = useState({
    agreementDate: "", startDate: "", endDate: "", autoRenewal: false, mainContent: "",
    memberBenefit: "", familyBenefit: "", usageCondition: "", notice: "",
  });
  const [medical, setMedical] = useState<Medical | null>(null);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function loadDetail(partnerId: string) {
    const data = await api.get<{ partner: Partner; agreements: Agreement[]; medical: Medical | null; images: ImageRow[]; files: FileRow[] }>(
      `/admin/partners/${partnerId}`
    );
    setPartner(data.partner);
    setForm({
      name: data.partner.name, category: data.partner.category, subCategory: data.partner.sub_category,
      representativeName: data.partner.representative_name ?? "",
      phone: data.partner.phone ?? "", website: data.partner.website ?? "", address: data.partner.address,
      detailAddress: data.partner.detail_address ?? "", postalCode: data.partner.postal_code ?? "",
      description: data.partner.description ?? "",
    });
    const a = data.agreements[0] ?? null;
    setAgreement(a);
    if (a) {
      setAgreementForm({
        agreementDate: a.agreement_date ?? "", startDate: a.start_date ?? "", endDate: a.end_date ?? "",
        autoRenewal: a.auto_renewal, mainContent: a.main_content ?? "", memberBenefit: a.member_benefit ?? "",
        familyBenefit: a.family_benefit ?? "", usageCondition: a.usage_condition ?? "", notice: a.notice ?? "",
      });
    }
    setMedical(data.medical);
    setImages(data.images);
    setFiles(data.files);
  }

  useEffect(() => {
    if (id) loadDetail(id);
  }, [id]);

  const categoryDef = CATEGORIES.find((c) => c.code === form.category)!;

  async function handleSaveBasic(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isNew) {
        const res = await api.post<{ partner: Partner }>("/admin/partners", form);
        navigate(`/admin/partners/${res.partner.id}`, { replace: true });
      } else {
        await api.put(`/admin/partners/${id}`, form);
        setSavedMsg("기본정보가 저장되었습니다.");
        loadDetail(id!);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    }
  }

  async function handleSaveAgreement(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const body = { partnerId: Number(id), ...agreementForm };
    if (agreement) {
      await api.put(`/admin/agreements/${agreement.id}`, body);
    } else {
      await api.post(`/admin/agreements`, body);
    }
    setSavedMsg("협약정보가 저장되었습니다.");
    loadDetail(id);
  }

  async function handleSaveMedical(e: FormEvent) {
    e.preventDefault();
    if (!id || !medical) return;
    await api.put(`/admin/medical-info/partner/${id}`, medical);
    setSavedMsg("의료기관 정보가 저장되었습니다.");
    loadDetail(id);
  }

  async function handleUploadImages(fileList: FileList | null) {
    if (!id || !fileList || fileList.length === 0) return;
    const fd = new FormData();
    Array.from(fileList).forEach((f) => fd.append("files", f));
    await api.post(`/admin/files/image/${id}`, fd);
    loadDetail(id);
  }

  async function handleUploadAgreementFile(fileList: FileList | null) {
    if (!id || !fileList || fileList.length === 0) return;
    const fd = new FormData();
    fd.append("file", fileList[0]);
    await api.post(`/admin/files/agreement/${id}`, fd);
    loadDetail(id);
  }

  if (!isNew && !partner) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{isNew ? "협약기관 추가" : partner?.name}</h1>
      {!isNew && <p className="text-sm text-slate-500 mb-6">기본정보/협약정보/의료정보/이미지/협약서를 각 섹션별로 저장합니다.</p>}
      {savedMsg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">{savedMsg}</p>}

      {/* 기본정보 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-4">기본정보</h2>
        <form onSubmit={handleSaveBasic} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">기관명 *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">대분류 *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subCategory: CATEGORIES.find((c) => c.code === e.target.value)!.subCategories[0] })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">세부분류 *</label>
              <select value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                {categoryDef.subCategories.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">대표자명</label>
              <input value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">대표전화</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="041-000-0000" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">홈페이지</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">주소 *</label>
            <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="충남 아산시 ○○로 123" />
            {partner && (
              <p className="text-xs mt-1 text-slate-400">
                지오코딩 상태: {partner.geocode_status === "ok" ? "성공" : partner.geocode_status === "failed" ? "주소를 확인해주세요" : "대기중"}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">상세설명</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="rounded-lg bg-brand-900 text-white text-sm font-medium px-4 py-2">
            {isNew ? "기관 추가" : "기본정보 저장"}
          </button>
        </form>
        {partner?.latitude && partner?.longitude && (
          <div className="mt-4">
            <MapView markers={[{ id: partner.id, lat: partner.latitude, lng: partner.longitude, title: partner.name }]} fallbackAddress={partner.address} height="200px" />
          </div>
        )}
      </section>

      {!isNew && (
        <>
          {/* 협약정보 */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-slate-900 mb-4">협약정보</h2>
            <form onSubmit={handleSaveAgreement} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">협약체결일</label>
                  <input type="date" value={agreementForm.agreementDate} onChange={(e) => setAgreementForm({ ...agreementForm, agreementDate: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">협약시작일</label>
                  <input type="date" value={agreementForm.startDate} onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">협약종료일</label>
                  <input type="date" value={agreementForm.endDate} onChange={(e) => setAgreementForm({ ...agreementForm, endDate: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={agreementForm.autoRenewal} onChange={(e) => setAgreementForm({ ...agreementForm, autoRenewal: e.target.checked })} />
                자동연장
              </label>
              <div>
                <label className="block text-sm text-slate-600 mb-1">협약 주요내용</label>
                <textarea value={agreementForm.mainContent} onChange={(e) => setAgreementForm({ ...agreementForm, mainContent: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">🎁 조합원 혜택</label>
                <textarea value={agreementForm.memberBenefit} onChange={(e) => setAgreementForm({ ...agreementForm, memberBenefit: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="예: 진료비 10% 할인" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">가족 혜택</label>
                <input value={agreementForm.familyBenefit} onChange={(e) => setAgreementForm({ ...agreementForm, familyBenefit: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="비워두면 가족 이용 불가로 표시됩니다" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">이용조건</label>
                <input value={agreementForm.usageCondition} onChange={(e) => setAgreementForm({ ...agreementForm, usageCondition: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="예: 모바일회원증 제시" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">유의사항</label>
                <input value={agreementForm.notice} onChange={(e) => setAgreementForm({ ...agreementForm, notice: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button className="rounded-lg bg-brand-900 text-white text-sm font-medium px-4 py-2">협약정보 저장</button>
            </form>
          </section>

          {/* 의료기관 전용정보 */}
          {form.category === "medical" && (
            <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
              <h2 className="font-bold text-slate-900 mb-4">의료기관 전용정보</h2>
              <MedicalSection medical={medical} onChange={setMedical} onSave={handleSaveMedical} />
            </section>
          )}

          {/* 이미지 */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-slate-900 mb-4">기관 이미지</h2>
            <div className="flex flex-wrap gap-3 mb-4">
              {images.map((img) => (
                <div key={img.id} className="relative">
                  <img src={`/api/files/image/${img.id}`} className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                  {img.is_main && <span className="absolute top-1 left-1 bg-brand-900 text-white text-[10px] px-1.5 py-0.5 rounded">대표</span>}
                  <div className="flex gap-1 mt-1">
                    {!img.is_main && (
                      <button onClick={async () => { await api.patch(`/admin/partners/${id}/representative-image`, { imageId: img.id }); loadDetail(id!); }} className="text-[11px] text-brand-700 underline">대표지정</button>
                    )}
                    <button onClick={async () => { await api.delete(`/admin/files/image/${img.id}`); loadDetail(id!); }} className="text-[11px] text-red-600 underline">삭제</button>
                  </div>
                </div>
              ))}
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => handleUploadImages(e.target.files)} className="text-sm" />
          </section>

          {/* 협약서 */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="font-bold text-slate-900 mb-4">협약서 관리</h2>
            <ul className="space-y-2 mb-4">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <a href={`/api/admin/files/agreement/${f.id}/preview`} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{f.file_name}</a>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      <input type="checkbox" checked={f.is_public} onChange={async (e) => { await api.patch(`/admin/files/agreement/${f.id}/public`, { isPublic: e.target.checked }); loadDetail(id!); }} />
                      공개
                    </label>
                    <button onClick={async () => { await api.delete(`/admin/files/agreement/${f.id}`); loadDetail(id!); }} className="text-xs text-red-600 underline">삭제</button>
                  </div>
                </li>
              ))}
              {files.length === 0 && <p className="text-sm text-slate-400">등록된 협약서가 없습니다.</p>}
            </ul>
            <input type="file" accept=".pdf,.hwp,.hwpx,.docx" onChange={(e) => handleUploadAgreementFile(e.target.files)} className="text-sm" />
            <p className="text-xs text-slate-400 mt-1">업로드 후 "공개"에 체크해야 조합원 화면에서 열람할 수 있습니다.</p>
          </section>
        </>
      )}
    </div>
  );
}

function MedicalSection({ medical, onChange, onSave }: { medical: Medical | null; onChange: (m: Medical) => void; onSave: (e: FormEvent) => void }) {
  const m: Medical = medical ?? {
    medical_type: "", departments: [], consultation_hours: "", parking_available: false,
    health_check_available: false, national_health_check: false, general_health_check: false,
    comprehensive_health_check: false, cancer_check: false, member_health_check: false,
    health_check_benefit: "", reservation_method: "",
  };

  const checks: { key: keyof Medical; label: string }[] = [
    { key: "health_check_available", label: "건강검진 가능" },
    { key: "national_health_check", label: "국가건강검진" },
    { key: "general_health_check", label: "일반건강검진" },
    { key: "comprehensive_health_check", label: "종합건강검진" },
    { key: "cancer_check", label: "암검진" },
    { key: "member_health_check", label: "조합원 특별검진" },
  ];

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div>
        <label className="block text-sm text-slate-600 mb-1">진료과목 (쉼표로 구분)</label>
        <input
          value={m.departments.join(", ")}
          onChange={(e) => onChange({ ...m, departments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="내과, 외과, 정형외과"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">진료시간</label>
          <input value={m.consultation_hours ?? ""} onChange={(e) => onChange({ ...m, consultation_hours: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 mt-6">
          <input type="checkbox" checked={m.parking_available ?? false} onChange={(e) => onChange({ ...m, parking_available: e.target.checked })} />
          주차 가능
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {checks.map((c) => (
          <label key={c.key} className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={Boolean(m[c.key])} onChange={(e) => onChange({ ...m, [c.key]: e.target.checked })} />
            {c.label}
          </label>
        ))}
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">건강검진 할인내용</label>
        <input value={m.health_check_benefit ?? ""} onChange={(e) => onChange({ ...m, health_check_benefit: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">검진 예약방법</label>
        <input value={m.reservation_method ?? ""} onChange={(e) => onChange({ ...m, reservation_method: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button className="rounded-lg bg-brand-900 text-white text-sm font-medium px-4 py-2">의료정보 저장</button>
    </form>
  );
}
