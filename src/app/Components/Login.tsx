"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

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

      router.push("/chatbot");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/90 p-8 rounded-2xl shadow-lg w-full max-w-md backdrop-blur-sm">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Signin</h2>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        className="w-full mb-4 p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="w-full mb-4 p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
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
      <p className="text-white/60 mt-4 text-center text-sm">
        Don’t have an account?{" "}
        <button
          onClick={onSwitchToRegister}
          className="text-purple-500 hover:underline"
        >
          Register
        </button>
      </p>
    </div>
  );
}
