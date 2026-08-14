import { NavLink, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "홈", icon: "🏠", match: (p: string) => p === "/" },
  { to: "/search", label: "검색", icon: "🔍", match: (p: string) => p === "/search" || p.startsWith("/category") },
  { to: "/map", label: "지도", icon: "🗺️", match: (p: string) => p === "/map" },
  { to: "/favorites", label: "즐겨찾기", icon: "⭐", match: (p: string) => p === "/favorites" },
];

export default function PublicLayout() {
  const location = useLocation();
  const showBottomNav = !location.pathname.startsWith("/partners/");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-brand-900 text-white px-4 py-3 shrink-0">
        <p className="text-[11px] text-brand-200">아산시공무원노동조합</p>
        <p className="font-bold">협약기관 안내</p>
      </header>

      <main className="flex-1 min-w-0 pb-16">
        <Outlet />
      </main>

      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex max-w-md mx-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.match(location.pathname);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center py-2 text-xs ${active ? "text-brand-900 font-semibold" : "text-slate-400"}`}
              >
                <span className="text-lg leading-none mb-0.5">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
