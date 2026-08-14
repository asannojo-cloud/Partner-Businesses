import { useState } from "react";
import { NavLink, Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAdminSessionContext } from "./AdminSessionContext";

const links = [
  { to: "/admin/dashboard", label: "대시보드" },
  { to: "/admin/partners", label: "협약기관 관리" },
  { to: "/admin/uploads", label: "자료 업로드" },
  { to: "/admin/ai-review", label: "AI 자동분류 검토" },
  { to: "/admin/excel", label: "Excel 관리" },
  { to: "/admin/agreements", label: "협약기간 관리" },
  { to: "/admin/categories", label: "카테고리 안내" },
  { to: "/admin/settings", label: "관리자 설정" },
];

export default function AdminLayout() {
  const { admin, loading, logout } = useAdminSessionContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">불러오는 중...</div>;
  }
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  async function handleLogout() {
    await logout();
    navigate("/admin/login", { replace: true });
  }

  const navItems = (
    <>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `block px-5 py-2.5 text-sm ${isActive ? "bg-brand-800 text-white font-medium" : "text-slate-300 hover:bg-brand-800/60"}`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
      <header className="md:hidden flex items-center justify-between bg-brand-900 text-white px-4 py-3 shrink-0">
        <div>
          <p className="text-[10px] text-slate-400">아산시공무원노동조합</p>
          <p className="font-bold text-sm">협약기관 관리자</p>
        </div>
        <button onClick={() => setMenuOpen((v) => !v)} aria-label="메뉴 열기" className="p-2 -mr-2 text-slate-200">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>
      {menuOpen && (
        <nav className="md:hidden bg-brand-900 border-t border-brand-700 shrink-0">
          {navItems}
          <div className="p-4 border-t border-brand-700">
            <p className="text-xs text-slate-400 mb-2">{admin.displayName}</p>
            <button onClick={handleLogout} className="text-xs text-slate-300 underline">로그아웃</button>
          </div>
        </nav>
      )}

      <aside className="hidden md:flex w-56 bg-brand-900 text-slate-200 flex-col shrink-0">
        <div className="p-5 border-b border-brand-700">
          <p className="text-xs text-slate-400">아산시공무원노동조합</p>
          <p className="font-bold text-white">협약기관 관리자</p>
        </div>
        <nav className="flex-1 py-3">{navItems}</nav>
        <div className="p-4 border-t border-brand-700">
          <p className="text-xs text-slate-400 mb-2">{admin.displayName}</p>
          <button onClick={handleLogout} className="text-xs text-slate-300 underline">로그아웃</button>
        </div>
      </aside>

      <main key={location.pathname} className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
