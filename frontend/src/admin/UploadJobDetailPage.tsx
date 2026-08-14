import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../shared/api";

interface DocRow { id: number; file_name: string; relative_path: string | null; file_type: string; processing_status: string; error_message: string | null; }
interface CandidateRow { id: number; partner_name: string | null; category: string | null; review_status: string; duplicate_partner_id: number | null; }
interface JobDetail { job: { id: number; upload_name: string; status: string; error_message: string | null }; documents: DocRow[]; candidates: CandidateRow[]; }

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨", analyzing: "AI 분석 중...", review_ready: "검토 대기", completed: "완료", failed: "실패",
};

export default function UploadJobDetailPage() {
  const { jobId } = useParams();
  const [data, setData] = useState<JobDetail | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    const d = await api.get<JobDetail>(`/admin/ai/jobs/${jobId}`);
    setData(d);
    return d;
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (data?.job.status !== "analyzing") return;
    const t = setInterval(async () => {
      const d = await load();
      if (d.job.status !== "analyzing") clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.job.status]);

  async function startAnalysis() {
    setAnalyzing(true);
    await api.post(`/admin/ai/jobs/${jobId}/analyze`);
    await load();
    setAnalyzing(false);
  }

  if (!data) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{data.job.upload_name}</h1>
      <p className="text-sm text-slate-500 mb-6">상태: {STATUS_LABEL[data.job.status] ?? data.job.status}</p>

      {(data.job.status === "uploaded" || data.job.status === "failed") && (
        <button onClick={startAnalysis} disabled={analyzing} className="rounded-lg bg-brand-900 text-white text-sm font-medium px-4 py-2 mb-6 disabled:opacity-50">
          {analyzing ? "분석 요청 중..." : "AI 분석 시작"}
        </button>
      )}
      {data.job.error_message && <p className="text-sm text-red-600 mb-4">{data.job.error_message}</p>}

      <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-4">업로드된 파일 ({data.documents.length})</h2>
        <ul className="space-y-1 text-sm">
          {data.documents.map((d) => (
            <li key={d.id} className="flex justify-between border-b border-slate-50 py-1.5 last:border-0">
              <span className="text-slate-700">{d.relative_path ?? d.file_name}</span>
              <span className={`text-xs ${d.processing_status === "failed" ? "text-red-500" : d.processing_status === "unsupported" ? "text-amber-600" : "text-slate-400"}`}>
                {d.processing_status === "extracted" ? "추출완료" : d.processing_status === "unsupported" ? "자동추출 미지원" : d.processing_status === "failed" ? "실패" : "대기"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.candidates.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-900 mb-4">AI 추출 후보 ({data.candidates.length})</h2>
          <ul className="space-y-2">
            {data.candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                <span>
                  {c.partner_name ?? "(기관명 미확인)"}
                  {c.duplicate_partner_id && <span className="ml-2 text-xs text-amber-600">중복 의심</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.review_status === "approved" ? "bg-green-100 text-green-700" : c.review_status === "rejected" ? "bg-slate-200 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                    {c.review_status === "approved" ? "승인됨" : c.review_status === "rejected" ? "반려됨" : "검토대기"}
                  </span>
                  <Link to={`/admin/ai-review/${c.id}`} className="text-brand-700 hover:underline">검토</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
