"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import ForgotPassword from "./ForgotPassword";

type LoginProps = {
  onSwitchToRegister: () => void;
  onLoginSuccess?: () => void;
};

export default function Login({ onSwitchToRegister }: LoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      localStorage.setItem("token", data.token);

      // Check if user is admin to determine redirect
      const user = data.user;
      console.log("Login response user:", user);
      console.log("User role:", user?.role);
      const isAdmin = user?.role === "admin";
      console.log("Is admin?", isAdmin);

      if (isAdmin) {
        // Admin users see dashboard selection page
        console.log("Redirecting to dashboard-select");
        router.push("/dashboard-select");
      } else {
        // Regular users go directly to chatbot
        console.log("Redirecting to chatbot");
        router.push("/chatbot");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
  }

  return (
    <div className="bg-gray-800/50 p-8 rounded-2xl shadow-lg border border-gray-700/50 w-full max-w-md lg:w-[460px] lg:h-[350px]">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        Sign in
      </h2>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        className="w-full mb-4 p-3 rounded-xl bg-gray-900/80 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700/50"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="relative mb-4">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          className="w-full p-3 rounded-xl bg-gray-900/80 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700/50"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all flex justify-center items-center"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          "Login"
        )}
      </button>

      <div className="mt-4 text-center">
        <button
          onClick={() => setShowForgotPassword(true)}
          className="text-purple-400 hover:text-purple-300 hover:underline text-sm"
        >
          Forgot Password?
        </button>
      </div>

      <p className="text-gray-400 mt-4 text-center text-sm">
        Don&apos;t have an account?{" "}
        <button
          onClick={() => router.push("/#plans")}
          className="text-purple-400 hover:text-purple-300 hover:underline"
        >
          Register
        </button>
      </p>
    </div>
  );
}
