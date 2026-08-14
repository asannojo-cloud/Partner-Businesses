import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, ApiError } from "../shared/api";
import { CATEGORIES } from "../shared/categories";

interface CandidateDetail {
  id: number; partner_name: string | null; category: string | null; sub_category: string | null;
  phone: string | null; website: string | null; address: string | null;
  agreement_date: string | null; start_date: string | null; end_date: string | null;
  main_content: string | null; member_benefit: string | null; family_benefit: string | null;
  usage_condition: string | null; notice: string | null;
  health_check_available: boolean | null; health_check_types: string | null; departments: string | null;
  field_confidence: Record<string, number>;
}
interface DocRow { id: number; file_name: string; extracted_text: string | null; processing_status: string; }
interface Duplicate { id: number; name: string; address: string }

const FIELDS: { key: string; label: string; type: "text" | "textarea" | "date" | "boolean" | "category" | "subcategory" }[] = [
  { key: "partnerName", label: "기관명", type: "text" },
  { key: "category", label: "대분류", type: "category" },
  { key: "subCategory", label: "세부분류", type: "subcategory" },
  { key: "address", label: "주소", type: "text" },
  { key: "phone", label: "전화", type: "text" },
  { key: "website", label: "홈페이지", type: "text" },
  { key: "startDate", label: "협약시작일", type: "date" },
  { key: "endDate", label: "협약종료일", type: "date" },
  { key: "mainContent", label: "협약 주요내용", type: "textarea" },
  { key: "memberBenefit", label: "조합원 혜택", type: "textarea" },
  { key: "familyBenefit", label: "가족 혜택", type: "textarea" },
  { key: "usageCondition", label: "이용조건", type: "text" },
  { key: "notice", label: "유의사항", type: "text" },
  { key: "healthCheckAvailable", label: "건강검진 가능", type: "boolean" },
  { key: "healthCheckTypes", label: "건강검진 내용", type: "text" },
  { key: "departments", label: "진료과목", type: "text" },
];

function toCamel(c: CandidateDetail): Record<string, any> {
  return {
    partnerName: c.partner_name, category: c.category, subCategory: c.sub_category, phone: c.phone,
    website: c.website, address: c.address, agreementDate: c.agreement_date, startDate: c.start_date,
    endDate: c.end_date, mainContent: c.main_content, memberBenefit: c.member_benefit,
    familyBenefit: c.family_benefit, usageCondition: c.usage_condition, notice: c.notice,
    healthCheckAvailable: c.health_check_available, healthCheckTypes: c.health_check_types,
    departments: c.departments,
  };
}

function confidenceBadge(v: number | undefined) {
  if (v == null) return null;
  const pct = Math.round(v * 100);
  const cls = v >= 0.7 ? "bg-green-100 text-green-700" : v >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>{pct}%{v < 0.5 ? " 확인필요" : ""}</span>;
}

export default function AiReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ candidate: CandidateDetail; documents: DocRow[]; duplicate: Duplicate | null }>(`/admin/ai/review/${id}`).then((d) => {
      setCandidate(d.candidate);
      setDocuments(d.documents);
      setDuplicate(d.duplicate);
      setForm(toCamel(d.candidate));
    });
  }, [id]);

  if (!candidate) return <p className="text-slate-400">불러오는 중...</p>;

  const categoryDef = CATEGORIES.find((c) => c.code === form.category);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/ai/review/${id}`, form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "임시저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/ai/review/${id}`, form);
      await api.post(`/admin/ai/review/${id}/approve`, { overrides: form });
      navigate("/admin/ai-review");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "승인 처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 검토 항목을 삭제하시겠습니까?")) return;
    await api.delete(`/admin/ai/review/${id}`);
    navigate("/admin/ai-review");
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">AI 추출 결과 검토</h1>
      <p className="text-sm text-slate-500 mb-6">항목별로 AI가 추출한 값을 확인하고, 필요하면 직접 수정한 뒤 승인하세요.</p>

      {duplicate && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 text-sm text-amber-800">
          기존 등록기관과 동일한 기관으로 판단됩니다: <Link to={`/admin/partners/${duplicate.id}`} className="underline font-medium">{duplicate.name}</Link> ({duplicate.address}).
          승인하면 별도의 신규 기관으로 등록됩니다 — 기존 정보를 갱신하려면 대신 해당 기관 편집 화면에서 직접 수정해주세요.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2 w-32">항목</th>
              <th className="px-4 py-2">AI 분석 결과 / 관리자 수정</th>
              <th className="px-4 py-2 w-24">신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => (
              <tr key={f.key} className="border-b border-slate-100 last:border-0 align-top">
                <td className="px-4 py-3 text-slate-600 font-medium">{f.label}</td>
                <td className="px-4 py-3">
                  {f.type === "text" && (
                    <input value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                  )}
                  {f.type === "textarea" && (
                    <textarea value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                  )}
                  {f.type === "date" && (
                    <input type="date" value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                  )}
                  {f.type === "boolean" && (
                    <input type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
                  )}
                  {f.type === "category" && (
                    <select value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value, subCategory: CATEGORIES.find((c) => c.code === e.target.value)?.subCategories[0] })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white">
                      <option value="">선택</option>
                      {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  )}
                  {f.type === "subcategory" && (
                    <select value={form.subCategory ?? ""} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white">
                      <option value="">선택</option>
                      {(categoryDef?.subCategories ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">{confidenceBadge(candidate.field_confidence?.[f.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {documents.length > 0 && (
        <details className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">원본 문서 텍스트 확인 ({documents.length}건)</summary>
          {documents.map((d) => (
            <div key={d.id} className="mt-3">
              <p className="font-medium text-slate-600">{d.file_name}</p>
              <pre className="whitespace-pre-wrap text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mt-1 max-h-40 overflow-y-auto">
                {d.extracted_text || (d.processing_status === "unsupported" ? "(자동 텍스트 추출 미지원 형식)" : "(추출된 텍스트 없음)")}
              </pre>
            </div>
          ))}
        </details>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={busy} className="rounded-lg border border-slate-300 bg-white text-sm font-medium px-4 py-2">임시저장</button>
        <button onClick={handleApprove} disabled={busy} className="rounded-lg bg-brand-900 text-white text-sm font-medium px-4 py-2">승인 후 등록</button>
        <button onClick={handleDelete} disabled={busy} className="rounded-lg text-red-600 text-sm font-medium px-4 py-2 ml-auto">삭제</button>
      </div>
    </div>
  );
}
