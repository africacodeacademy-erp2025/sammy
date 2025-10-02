// app/components/UI/SidebarButton.tsx
"use client";

type SidebarButtonProps = {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
};

export default function SidebarButton({
  title,
  description,
  icon,
  onClick,
  className = "",
}: SidebarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-800/70 transition-colors ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-700/20 rounded-lg">{icon}</div>
        <div className="text-left">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          {description && (
            <p className="text-xs text-gray-400">{description}</p>
          )}
        </div>
      </div>
      <span className="text-gray-400">→</span>
    </button>
  );
}
