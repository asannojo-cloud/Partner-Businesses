import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../shared/api";

interface RowData {
  id: number; row_number: number; raw_data: Record<string, string>; diff_type: "new" | "changed" | "ended" | "unchanged" | "error";
  diff_fields: { field: string; before: string | null; after: string | null }[]; error_message: string | null; approved: boolean;
}

const GROUP_META: Record<string, { label: string; icon: string; color: string }> = {
  new: { label: "신규", icon: "🟢", color: "text-green-700" },
  changed: { label: "정보 변경", icon: "🟡", color: "text-amber-700" },
  ended: { label: "협약 종료", icon: "🔴", color: "text-red-700" },
  unchanged: { label: "변경 없음", icon: "⚪", color: "text-slate-500" },
  error: { label: "오류 (건너뜀)", icon: "⚠️", color: "text-red-700" },
};

export default function ExcelJobDetailPage() {
  const { jobId } = useParams();
  const [rows, setRows] = useState<RowData[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  async function load() {
    const d = await api.get<{ rows: RowData[] }>(`/admin/excel/import/${jobId}`);
    setRows(d.rows);
    setSelected(new Set(d.rows.filter((r) => r.diff_type === "new" || r.diff_type === "changed").map((r) => r.id)));
  }
  useEffect(() => { load(); }, [jobId]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // 체크박스가 있는(선택 가능한) 행 전체 — 변경없음/오류 행은 애초에 체크박스가 없다.
  const selectableRows = rows.filter((r) => r.diff_type !== "unchanged" && r.diff_type !== "error" && !r.approved);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id));

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(selectableRows.map((r) => r.id)));
  }

  function toggleSelectGroup(group: RowData["diff_type"]) {
    const groupRows = rows.filter((r) => r.diff_type === group && !r.approved);
    const groupAllSelected = groupRows.length > 0 && groupRows.every((r) => selected.has(r.id));
    setSelected((prev) => {
      const next = new Set(prev);
      groupRows.forEach((r) => (groupAllSelected ? next.delete(r.id) : next.add(r.id)));
      return next;
    });
  }

  async function handleApprove() {
    setBusy(true);
    setResultMsg(null);
    try {
      const res = await api.post<{ results: { rowId: number; ok: boolean; error?: string }[] }>(
        `/admin/excel/import/${jobId}/approve`,
        { rowIds: Array.from(selected) }
      );
      const failCount = res.results.filter((r) => !r.ok).length;
      setResultMsg(failCount === 0 ? `${res.results.length}건 반영 완료` : `${res.results.length}건 중 ${failCount}건 실패 (콘솔/재시도 확인 필요)`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const groups: RowData["diff_type"][] = ["new", "changed", "ended", "unchanged", "error"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Excel 비교 결과</h1>
        {selectableRows.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg px-3 py-1.5 cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            전체선택 ({selected.size}/{selectableRows.length})
          </label>
        )}
      </div>
      {resultMsg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">{resultMsg}</p>}

      {groups.map((g) => {
        const groupRows = rows.filter((r) => r.diff_type === g);
        if (groupRows.length === 0) return null;
        const meta = GROUP_META[g];
        const selectableGroupRows = groupRows.filter((r) => !r.approved);
        const groupAllSelected = selectableGroupRows.length > 0 && selectableGroupRows.every((r) => selected.has(r.id));
        return (
          <section key={g} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className={`font-bold ${meta.color}`}>{meta.icon} {meta.label} ({groupRows.length})</h2>
              {(g === "new" || g === "changed" || g === "ended") && selectableGroupRows.length > 0 && (
                <button onClick={() => toggleSelectGroup(g)} className="text-xs text-slate-400 underline">
                  {groupAllSelected ? "이 그룹 선택 해제" : "이 그룹 전체선택"}
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {groupRows.map((r) => (
                <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                  {g !== "unchanged" && g !== "error" && (
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} disabled={r.approved} className="mt-1" />
                  )}
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-slate-900">
                      {r.raw_data.name} {r.approved && <span className="text-xs text-green-600 ml-2">반영됨</span>}
                    </p>
                    {g === "changed" && r.diff_fields.length > 0 && (
                      <ul className="text-xs text-slate-500 mt-1 space-y-0.5">
                        {r.diff_fields.map((f, i) => (
                          <li key={i}>{f.field}: <span className="line-through text-slate-400">{f.before || "(없음)"}</span> → <span className="text-slate-700">{f.after}</span></li>
                        ))}
                      </ul>
                    )}
                    {g === "error" && <p className="text-xs text-red-600 mt-1">{r.error_message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <button onClick={handleApprove} disabled={busy || selected.size === 0} className="rounded-lg bg-brand-900 text-white text-sm font-medium px-5 py-2.5 disabled:opacity-50">
        {busy ? "반영 중..." : `선택한 ${selected.size}건 승인 반영`}
      </button>
    </div>
  );
}
