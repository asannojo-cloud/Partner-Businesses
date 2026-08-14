import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, fileUrl } from "../shared/api";
import { CATEGORIES } from "../shared/categories";
import { categoryLabel } from "../shared/formatters";
import { computeAgreementStatus, STATUS_LABEL, STATUS_COLOR } from "../shared/agreementStatus";

interface PartnerRow {
  id: number;
  name: string;
  category: string;
  sub_category: string;
  address: string;
  status: "active" | "inactive";
  end_date: string | null;
  auto_renewal: boolean;
  representative_image_id: number | null;
}

interface ExcelImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: { rowNumber: number; name: string | undefined; error: string }[];
}

export default function PartnersListPage() {
  const [items, setItems] = useState<PartnerRow[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResult, setExcelResult] = useState<ExcelImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetId = useRef<number | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    params.set("pageSize", "200"); // 전체 협약기관 규모가 수백 곳 이내라 별도 페이지네이션 UI 없이 한 번에 보여준다.
    const data = await api.get<{ items: PartnerRow[] }>(`/admin/partners?${params.toString()}`);
    setItems(data.items);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  async function toggleStatus(p: PartnerRow) {
    const next = p.status === "active" ? "inactive" : "active";
    await api.patch(`/admin/partners/${p.id}/status`, { status: next });
    load();
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((p) => p.id))));
  }

  async function bulkSetStatus(next: "active" | "inactive") {
    if (selected.size === 0) return;
    await Promise.all([...selected].map((id) => api.patch(`/admin/partners/${id}/status`, { status: next })));
    load();
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}개 협약기관을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    await Promise.all([...selected].map((id) => api.delete(`/admin/partners/${id}`)));
    load();
  }

  function openUploadFor(id: number) {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  }

  async function uploadImageFile(partnerId: number, file: File) {
    setUploadingId(partnerId);
    try {
      const form = new FormData();
      form.append("files", file);
      await api.post(`/admin/files/image/${partnerId}`, form);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const partnerId = uploadTargetId.current;
    e.target.value = "";
    if (!file || !partnerId) return;
    await uploadImageFile(partnerId, file);
  }

  // 네이버 등에서 이미지를 복사한 뒤, 썸네일을 우클릭 → 붙여넣기(또는 Ctrl+V)로 바로 등록할 수 있게 한다.
  // 썸네일을 contentEditable로 만들면 브라우저 우클릭 메뉴에 "붙여넣기"가 뜨고 paste 이벤트를 받을 수 있다.
  function handleThumbPaste(e: React.ClipboardEvent<HTMLDivElement>, partnerId: number) {
    e.preventDefault();
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) uploadImageFile(partnerId, file);
        return;
      }
    }
    alert("클립보드에 복사된 이미지가 없습니다. 이미지를 먼저 복사(Ctrl+C)해주세요.");
  }

  // 붙여넣기 외에 텍스트 타이핑으로 썸네일 내용이 바뀌는 것을 막는다 (Ctrl/Cmd 조합키는 허용).
  function blockTypingExceptShortcuts(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) e.preventDefault();
  }

  // 엑셀 업로드는 검토 화면 없이 즉시 반영된다 (신규는 등록, 기존 기관은 이름 일치 시 갱신).
  // 엑셀에 없다고 기존 기관을 임의로 종료 처리하지는 않는다.
  async function handleExcelChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExcelUploading(true);
    setExcelResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api.post<ExcelImportResult>("/admin/excel/import", form);
      setExcelResult(result);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "엑셀 업로드에 실패했습니다.");
    } finally {
      setExcelUploading(false);
    }
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChosen} />
      <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelChosen} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">협약기관 관리</h1>
        <div className="flex items-center gap-2">
          <a href="/api/admin/excel/template" className="rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 font-medium text-slate-600">
            양식 다운로드
          </a>
          <button
            onClick={() => excelInputRef.current?.click()}
            disabled={excelUploading}
            className="rounded-lg border border-brand-700 text-brand-700 bg-white text-sm px-3 py-2 font-medium disabled:opacity-50"
          >
            {excelUploading ? "업로드 중..." : "📊 엑셀 업로드"}
          </button>
          <Link to="/admin/partners/new" className="rounded-lg bg-brand-900 text-white text-sm px-4 py-2 font-medium">
            + 협약기관 추가
          </Link>
        </div>
      </div>

      {excelResult && (
        <div className="mb-4 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium text-brand-800">
              엑셀 반영 완료 — 전체 {excelResult.totalRows}행 중 신규 {excelResult.inserted}건, 갱신 {excelResult.updated}건
              {excelResult.skipped.length > 0 && `, 건너뜀 ${excelResult.skipped.length}건`}
            </p>
            <button onClick={() => setExcelResult(null)} className="text-xs text-brand-600 underline shrink-0 ml-3">닫기</button>
          </div>
          {excelResult.skipped.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-600">
              {excelResult.skipped.map((s, i) => (
                <li key={i}>{s.rowNumber}행 {s.name ? `(${s.name})` : ""}: {s.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="기관명, 주소 검색"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-56"
          />
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">검색</button>
        </form>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
          <option value="">전체 대분류</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 rounded-xl bg-brand-50 border border-brand-200 px-4 py-2.5 text-sm">
          <span className="font-medium text-brand-800">{selected.size}개 선택됨</span>
          <button onClick={() => bulkSetStatus("active")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">일괄 활성화</button>
          <button onClick={() => bulkSetStatus("inactive")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">일괄 비활성화</button>
          <button onClick={bulkDelete} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs text-red-600">일괄 삭제</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-400 underline">선택 해제</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleSelectAll}
                  aria-label="전체 선택"
                />
              </th>
              <th className="px-4 py-3 w-16">사진</th>
              <th className="px-4 py-3">기관명</th>
              <th className="px-4 py-3">분류</th>
              <th className="px-4 py-3">주소</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">협약상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">협약기관이 없습니다.</td></tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      aria-label={`${p.name} 선택`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div
                      key={p.representative_image_id ?? "empty"}
                      role="button"
                      tabIndex={0}
                      contentEditable
                      suppressContentEditableWarning
                      onClick={() => openUploadFor(p.id)}
                      onKeyDown={(e) => {
                        blockTypingExceptShortcuts(e);
                        if (e.key === "Enter" || e.key === " ") openUploadFor(p.id);
                      }}
                      onPaste={(e) => handleThumbPaste(e, p.id)}
                      title="클릭하면 파일 선택, 우클릭 후 붙여넣기(Ctrl+V)로 복사한 이미지를 바로 등록할 수 있습니다."
                      className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer outline-none focus:ring-2 focus:ring-brand-400"
                    >
                      {uploadingId === p.id ? (
                        <span className="text-[10px] text-slate-400 select-none">업로드중</span>
                      ) : p.representative_image_id ? (
                        <img src={fileUrl(`/files/image/${p.representative_image_id}`)} alt={p.name} className="w-full h-full object-cover pointer-events-none" />
                      ) : (
                        <span className="text-[10px] text-slate-400 leading-tight text-center select-none">이미지<br />없음</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/partners/${p.id}`} className="text-brand-700 hover:underline font-medium">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{categoryLabel(p.category)} / {p.sub_category}</td>
                  <td className="px-4 py-3 text-slate-600">{p.address}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                      {p.status === "active" ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const s = computeAgreementStatus(p.end_date, p.auto_renewal);
                      return <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${STATUS_COLOR[s]}`}>{STATUS_LABEL[s]}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleStatus(p)} className="text-xs text-slate-500 underline">
                      {p.status === "active" ? "비활성화" : "활성화"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
