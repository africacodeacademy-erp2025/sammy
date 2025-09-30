"use client";

interface TestButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function TestButton({
  loading,
  disabled,
  onClick,
  className = "",
}: TestButtonProps) {
  return (
    <button
      className={`
        bg-gradient-to-r from-green-400 to-teal-500 
        text-white px-3 sm:px-4 py-2 min-h-[36px] 
        rounded-3xl hover:from-green-500 hover:to-teal-600 
        transition-all disabled:opacity-50 flex items-center 
        justify-center shadow-md 
        w-full md:w-auto  /* responsive width */
        ${className}
      `}
      disabled={disabled || loading}
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-sm">Test Tokens</span>
          <span className="text-xs">🔌</span>
        </div>
      )}
    </button>
  );
}
