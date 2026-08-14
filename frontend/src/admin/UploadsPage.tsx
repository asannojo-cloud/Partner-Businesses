import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../shared/api";

interface JobRow {
  id: number; upload_name: string; source_type: string; file_count: number; status: string;
  pending_review_count: number; created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨 (분석 대기)", analyzing: "AI 분석 중", review_ready: "검토 대기",
  completed: "완료", failed: "실패",
};

export default function UploadsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function loadJobs() {
    const data = await api.get<{ items: JobRow[] }>("/admin/ai/jobs");
    setJobs(data.items);
  }
  useEffect(() => { loadJobs(); }, []);

  async function handleFiles(fileList: FileList | null, sourceType: "folder" | "files") {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const files = Array.from(fileList);
      const fd = new FormData();
      const paths: (string | null)[] = [];
      for (const f of files) {
        fd.append("files", f);
        paths.push((f as any).webkitRelativePath || null);
      }
      fd.append("pathsJson", JSON.stringify(paths));
      fd.append("sourceType", sourceType);
      fd.append("uploadName", sourceType === "folder" ? `폴더 업로드 (${files.length}개 파일)` : `파일 업로드 (${files.length}개 파일)`);

      const res = await api.post<{ job: JobRow }>("/admin/uploads", fd);
      await loadJobs();
      navigate(`/admin/uploads/${res.job.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
      if (filesInputRef.current) filesInputRef.current.value = "";
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">자료 업로드</h1>
      <p className="text-sm text-slate-500 mb-6">
        협약서/이미지/자료가 담긴 폴더 또는 개별 파일을 업로드하면 AI가 기관 정보를 분석·추출합니다.
        업로드는 사용자가 직접 선택한 파일만 대상으로 하며, 분석 결과는 관리자 승인 전까지 공개되지 않습니다.
      </p>

      <div className="flex flex-wrap gap-4 mb-8">
        <label className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center cursor-pointer hover:border-brand-400 flex-1 min-w-[220px]">
          <p className="text-2xl mb-2">📁</p>
          <p className="font-medium text-slate-900">폴더 업로드</p>
          <p className="text-xs text-slate-400 mt-1">협약기관별 하위 폴더 구조를 그대로 인식합니다</p>
          <input
            ref={folderInputRef}
            type="file"
            // webkitdirectory/directory는 표준 React 타입 정의에 없지만 대부분의 브라우저가 지원한다.
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files, "folder")}
          />
        </label>
        <label className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center cursor-pointer hover:border-brand-400 flex-1 min-w-[220px]">
          <p className="text-2xl mb-2">📄</p>
          <p className="font-medium text-slate-900">파일 업로드</p>
          <p className="text-xs text-slate-400 mt-1">개별 협약서/이미지 파일을 여러 개 선택합니다</p>
          <input ref={filesInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files, "files")} />
        </label>
      </div>

      {uploading && <p className="text-sm text-brand-700 mb-4">업로드 중입니다...</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <h2 className="font-bold text-slate-900 mb-3">업로드 이력</h2>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3">업로드명</th>
              <th className="px-4 py-3">파일수</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">업로드일</th>
            </tr>
          </thead>
          <tbody>
            {jobs.filter((j) => j.source_type !== "excel").map((j) => (
              <tr key={j.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3"><Link to={`/admin/uploads/${j.id}`} className="text-brand-700 hover:underline">{j.upload_name}</Link></td>
                <td className="px-4 py-3 text-slate-600">{j.file_count}</td>
                <td className="px-4 py-3 text-slate-600">{STATUS_LABEL[j.status] ?? j.status}</td>
                <td className="px-4 py-3 text-slate-400">{new Date(j.created_at).toLocaleString("ko-KR")}</td>
              </tr>
            ))}
            {jobs.filter((j) => j.source_type !== "excel").length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">업로드 이력이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
