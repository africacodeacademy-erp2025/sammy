"use client";

import { LogOut, Settings } from "lucide-react";

interface ProfileMenuProps {
  email: string;
  open: boolean;
  onToggle: () => void;
  onProfileSettings: () => void;
  onLogout: () => void;
}

const getInitials = (email: string) => email.slice(0, 2).toUpperCase();

export default function ProfileMenu({
  email,
  open,
  onToggle,
  onProfileSettings,
  onLogout,
}: ProfileMenuProps) {
  return (
    <div className="relative profile-dropdown">
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white font-bold text-[11px] leading-none uppercase transition-colors border-2 border-transparent hover:border-purple-400 overflow-hidden shrink-0 select-none"
        title={email}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {getInitials(email)}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="absolute right-0 top-full mt-2 w-72 max-w-[80vw] bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 py-2 z-50 ring-1 ring-white/10"
        >
          {/* User Info */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm leading-none uppercase overflow-hidden shrink-0 select-none">
                {getInitials(email)}
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium text-sm truncate" title={email}>
                  {email}
                </p>
                <p className="text-gray-400 text-xs">Signed in</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={onProfileSettings}
              className="w-full px-4 py-2 text-left text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-3"
              role="menuitem"
            >
              <Settings size={16} />
              <span className="text-sm">Profile Settings</span>
            </button>
            <button
              onClick={onLogout}
              className="w-full px-4 py-2 text-left text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-3"
              role="menuitem"
            >
              <LogOut size={16} />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
