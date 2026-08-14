import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdminSessionContext } from "./AdminSessionContext";
import { ApiError } from "../shared/api";
import PasswordInput from "../shared/PasswordInput";

export default function AdminLoginPage() {
  const { admin, loading, login } = useAdminSessionContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && admin) return <Navigate to="/admin/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <p className="text-xs text-slate-400 mb-1">아산시공무원노동조합</p>
        <h1 className="text-xl font-bold text-slate-900 mb-6">협약기관 관리자</h1>

        <label className="block text-sm text-slate-600 mb-1">아이디</label>
        <input
          className="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <label className="block text-sm text-slate-600 mb-1">비밀번호</label>
        <PasswordInput
          value={password}
          onChange={setPassword}
          className="w-full mb-6 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-900 text-white py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "로그인 중..." : "로그인"}
        </button>
        <p className="text-xs text-slate-400 mt-4">
          최초 계정: admin / Admin!2026 (README 참고, 운영 전 반드시 변경)
        </p>
      </form>
    </div>
  );
}
