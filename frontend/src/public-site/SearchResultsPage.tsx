import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../shared/api";
import { CATEGORIES } from "../shared/categories";
import PartnerCard, { type PartnerCardData } from "../shared/PartnerCard";

interface ListResponse { items: PartnerCardData[]; total: number; page: number; pageSize: number; }

export default function SearchResultsPage() {
  const { category: categoryParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<PartnerCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // 서버는 페이지 단위로 가져온 뒤 종료된 협약을 걸러내므로(백엔드 partners.service.ts 주석 참고),
  // total은 필터링 이전 개수를 반영할 수 있다. "더보기"가 빈 페이지를 반환하면 그 시점에 멈춰
  // total과 실제 노출 가능한 개수가 어긋나도 무한 대기 버튼이 되지 않게 한다.
  const [exhausted, setExhausted] = useState(false);

  const q = searchParams.get("q") ?? "";
  // 대분류는 두 가지 경로로 정해질 수 있다: 홈 화면 카테고리 그리드처럼 라우트로 들어오는 경우
  // (/category/:category), 또는 이 페이지의 "상세검색"에서 직접 칩을 눌러 쿼리스트링으로 필터링하는
  // 경우 (?category=...). 두 값을 하나로 합쳐서 다룬다.
  const categoryCode = categoryParam || searchParams.get("category") || "";
  const subCategory = searchParams.get("subCategory") ?? "";
  const healthCheck = searchParams.get("healthCheck") === "true";
  const memberDiscount = searchParams.get("memberDiscount") === "true";
  const familyAvailable = searchParams.get("familyAvailable") === "true";
  const sort = searchParams.get("sort") ?? "name";

  const categoryDef = categoryCode ? CATEGORIES.find((c) => c.code === categoryCode) ?? null : null;

  const [qDraft, setQDraft] = useState(q);
  useEffect(() => setQDraft(q), [q]);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  async function load(nextPage: number, append: boolean) {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoryCode) params.set("category", categoryCode);
    if (subCategory) params.set("subCategory", subCategory);
    if (healthCheck) params.set("healthCheck", "true");
    if (memberDiscount) params.set("memberDiscount", "true");
    if (familyAvailable) params.set("familyAvailable", "true");
    params.set("sort", sort);
    params.set("page", String(nextPage));
    params.set("pageSize", "20");

    const data = await api.get<ListResponse>(`/partners?${params.toString()}`);
    setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    setTotal(data.total);
    setPage(nextPage);
    setExhausted(data.items.length === 0);
    setLoading(false);
  }

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryCode, q, subCategory, healthCheck, memberDiscount, familyAvailable, sort]);

  function setFilter(key: string, value: string | boolean | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === false || value === "") next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next);
  }

  // /category/:category 라우트로 들어온 경우엔 category가 URL 경로에 있으므로 쿼리스트링에서 지워도
  // 소용없다 — 이 경우엔 /search로 이동해 라우트 자체를 벗어난다.
  function clearCategory() {
    if (categoryParam) {
      navigate(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("category");
    next.delete("subCategory");
    setSearchParams(next);
  }

  function selectCategory(code: string) {
    if (categoryParam) {
      // 라우트 기반으로 들어온 경우 다른 대분류를 고르면 그 라우트로 이동한다.
      navigate(`/category/${code}`);
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (categoryCode === code) {
      next.delete("category");
    } else {
      next.set("category", code);
    }
    next.delete("subCategory");
    setSearchParams(next);
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setFilter("q", qDraft.trim() || null);
  }

  return (
    <div className="p-4">
      <form onSubmit={handleSearchSubmit} className="mb-4">
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
          <span className="mr-2">🔍</span>
          <input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="기관명, 지역, 혜택을 검색하세요"
            className="flex-1 outline-none text-sm"
          />
          {qDraft && (
            <button
              type="button"
              onClick={() => { setQDraft(""); setFilter("q", null); }}
              aria-label="검색어 지우기"
              className="text-slate-400 px-1"
            >
              ✕
            </button>
          )}
          <button type="submit" className="ml-1 rounded-lg bg-brand-900 text-white text-xs font-medium px-3 py-1.5">검색</button>
        </div>
      </form>

      <details ref={detailsRef} className="mb-4 bg-white rounded-2xl border border-slate-200 open:pb-3" open={Boolean(categoryDef)}>
        <summary className="px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer select-none">
          🔎 상세검색 — 분류로 찾기{categoryDef ? ` (${categoryDef.label}${subCategory ? ` / ${subCategory}` : ""})` : ""}
        </summary>
        <div className="px-4">
          <p className="text-xs text-slate-400 mb-2">대분류 선택</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.code}
                onClick={() => selectCategory(c.code)}
                className={`text-xs px-2.5 py-1 rounded-full border ${categoryCode === c.code ? "bg-brand-900 text-white border-brand-900" : "bg-white border-slate-300 text-slate-600"}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {categoryDef && (
            <>
              <p className="text-xs text-slate-400 mb-2">세부분류 선택</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button onClick={() => setFilter("subCategory", null)} className={`text-xs px-2.5 py-1 rounded-full border ${!subCategory ? "bg-brand-700 text-white border-brand-700" : "bg-white border-slate-300 text-slate-600"}`}>전체</button>
                {categoryDef.subCategories.map((s) => (
                  <button key={s} onClick={() => setFilter("subCategory", s)} className={`text-xs px-2.5 py-1 rounded-full border ${subCategory === s ? "bg-brand-700 text-white border-brand-700" : "bg-white border-slate-300 text-slate-600"}`}>{s}</button>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => { if (detailsRef.current) detailsRef.current.open = false; }}
              className="rounded-lg bg-brand-900 text-white text-xs font-medium px-4 py-1.5"
            >
              검색
            </button>
          </div>
        </div>
      </details>

      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">
          {categoryDef ? categoryDef.label : q ? `"${q}" 검색결과` : "전체 협약기관"}
        </h1>
        {categoryDef && (
          <button onClick={clearCategory} className="text-xs text-slate-400 underline">분류 해제</button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => setFilter("healthCheck", !healthCheck)} className={`text-xs px-2.5 py-1 rounded-full border ${healthCheck ? "bg-brand-100 text-brand-700 border-brand-300" : "bg-white border-slate-300 text-slate-600"}`}>건강검진 가능</button>
        <button onClick={() => setFilter("memberDiscount", !memberDiscount)} className={`text-xs px-2.5 py-1 rounded-full border ${memberDiscount ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-white border-slate-300 text-slate-600"}`}>조합원 할인</button>
        <button onClick={() => setFilter("familyAvailable", !familyAvailable)} className={`text-xs px-2.5 py-1 rounded-full border ${familyAvailable ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-white border-slate-300 text-slate-600"}`}>가족 이용 가능</button>
        <select value={sort} onChange={(e) => setFilter("sort", e.target.value)} className="text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-600 ml-auto">
          <option value="name">가나다순</option>
          <option value="latest">최신 협약순</option>
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">총 {total}곳</p>

      <div className="space-y-3">
        {items.map((p) => <PartnerCard key={p.id} partner={p} />)}
      </div>

      {loading && <p className="text-center text-sm text-slate-400 py-6">불러오는 중...</p>}
      {!loading && items.length === 0 && <p className="text-center text-sm text-slate-400 py-10">검색 결과가 없습니다.</p>}
      {!loading && !exhausted && items.length < total && (
        <button onClick={() => load(page + 1, true)} className="w-full mt-4 rounded-xl border border-slate-300 bg-white py-2.5 text-sm text-slate-600">더보기</button>
      )}
    </div>
  );
}
