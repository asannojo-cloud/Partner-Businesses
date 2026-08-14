import { useState, type FormEvent } from "react";
import { api, ApiError } from "../shared/api";
import { useAdminSessionContext } from "./AdminSessionContext";
import PasswordInput from "../shared/PasswordInput";

export default function AdminSettingsPage() {
  const { admin } = useAdminSessionContext();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setBusy(true);
    try {
      await api.patch("/admin/auth/password", { currentPassword, newPassword });
      setSuccess("비밀번호가 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "비밀번호 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">관리자 설정</h1>
      <p className="text-sm text-slate-500 mb-6">
        현재 로그인 계정: <span className="font-medium text-slate-700">{admin?.username}</span> ({admin?.displayName})
      </p>

      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-900 mb-4">비밀번호 변경</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">현재 비밀번호</label>
            <PasswordInput
              required
              value={currentPassword}
              onChange={setCurrentPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">새 비밀번호 (8자 이상)</label>
            <PasswordInput
              required
              minLength={8}
              value={newPassword}
              onChange={setNewPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">새 비밀번호 확인</label>
            <PasswordInput
              required
              value={confirmPassword}
              onChange={setConfirmPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            {busy ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </section>
    </div>
  );
}
