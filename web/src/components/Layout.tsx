import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Avatar } from "./Avatar";
import {
  ActivityIcon,
  FolderIcon,
  KeyIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
} from "./icons";

function NavItem({
  to,
  end,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "border-ember-500 bg-ember-50 text-ember-700 dark:bg-ember-950/40 dark:text-ember-300"
            : "border-transparent text-paper-600 hover:bg-paper-100 hover:text-paper-900 dark:text-paper-400 dark:hover:bg-paper-800 dark:hover:text-paper-100"
        }`
      }
    >
      <span className="opacity-80 group-hover:opacity-100">{icon}</span>
      {children}
    </NavLink>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-paper-50 dark:bg-paper-950">
      <aside className="flex w-60 shrink-0 flex-col border-r border-paper-200 bg-white dark:border-paper-800 dark:bg-paper-900">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember-600 font-display text-base font-bold text-white">
            e
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-paper-900 dark:text-paper-50">
            estri
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <NavItem to="/" end icon={<FolderIcon className="h-4 w-4" />}>
            Browser
          </NavItem>
          {user?.role === "admin" && (
            <>
              <div className="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wider text-paper-400 dark:text-paper-500">
                Admin
              </div>
              <NavItem to="/admin/users" icon={<UsersIcon className="h-4 w-4" />}>
                Users
              </NavItem>
              <NavItem to="/admin/credentials" icon={<KeyIcon className="h-4 w-4" />}>
                AWS Credentials
              </NavItem>
              <NavItem to="/admin/buckets" icon={<FolderIcon className="h-4 w-4" />}>
                Buckets
              </NavItem>
              <NavItem to="/admin/audit-log" icon={<ActivityIcon className="h-4 w-4" />}>
                Audit Log
              </NavItem>
            </>
          )}
        </nav>

        <div className="border-t border-paper-200 p-3 dark:border-paper-800">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar name={user?.username ?? "?"} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-paper-800 dark:text-paper-100">
                {user?.username}
              </div>
              <div className="truncate text-xs capitalize text-paper-400 dark:text-paper-500">
                {user?.role}
              </div>
            </div>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="shrink-0 rounded-md p-1.5 text-paper-400 hover:bg-paper-100 hover:text-paper-700 dark:text-paper-500 dark:hover:bg-paper-800 dark:hover:text-paper-200"
            >
              {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-paper-500 hover:bg-paper-100 hover:text-paper-900 dark:text-paper-400 dark:hover:bg-paper-800 dark:hover:text-paper-100"
          >
            <LogoutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
