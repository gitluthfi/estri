import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-brand-600 text-white"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            e
          </div>
          <span className="text-lg font-semibold tracking-tight">estri</span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <NavLink to="/" end className={navLinkClass}>
            Browser
          </NavLink>
          {user?.role === "admin" && (
            <>
              <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Admin
              </div>
              <NavLink to="/admin/users" className={navLinkClass}>
                Users
              </NavLink>
              <NavLink to="/admin/credentials" className={navLinkClass}>
                AWS Credentials
              </NavLink>
              <NavLink to="/admin/buckets" className={navLinkClass}>
                Buckets
              </NavLink>
            </>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
              {user?.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">
                {user?.username}
              </div>
              <div className="truncate text-xs capitalize text-slate-400">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
