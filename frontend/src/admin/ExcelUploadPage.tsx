import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../shared/api";

interface JobRow { id: number; upload_name: string; file_count: number; status: string; created_at: string; }

export default function ExcelUploadPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ items: JobRow[] }>("/admin/excel/imports").then((d) => setJobs(d.items));
  }, []);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", fileList[0]);
      const res = await api.post<{ jobId: number }>("/admin/excel/import", fd);
      navigate(`/admin/excel/${res.jobId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Excel 관리</h1>
      <p className="text-sm text-slate-500 mb-4">
        기존 보유 중인 협약기관 명단(Excel)을 업로드하면 현재 DB와 비교해 신규/변경/협약종료/변경없음을 자동으로 구분합니다.
      </p>
      <a href="/api/admin/excel/template" className="inline-block text-sm text-brand-700 underline mb-6">📄 업로드 양식 다운로드</a>

      <label className="block rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center cursor-pointer hover:border-brand-400 mb-8">
        <p className="text-2xl mb-2">📊</p>
        <p className="font-medium text-slate-900">{uploading ? "업로드 중..." : "Excel 파일 업로드 (xlsx, xls, csv)"}</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
      </label>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <h2 className="font-bold text-slate-900 mb-3">업로드 이력</h2>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3">파일명</th>
              <th className="px-4 py-3">행 수</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">업로드일</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3"><Link to={`/admin/excel/${j.id}`} className="text-brand-700 hover:underline">{j.upload_name}</Link></td>
                <td className="px-4 py-3 text-slate-600">{j.file_count}</td>
                <td className="px-4 py-3 text-slate-600">{j.status === "completed" ? "완료" : j.status === "review_ready" ? "검토 대기" : j.status}</td>
                <td className="px-4 py-3 text-slate-400">{new Date(j.created_at).toLocaleString("ko-KR")}</td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">업로드 이력이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
