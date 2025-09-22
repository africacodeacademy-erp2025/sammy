"use client";
import React, { useState, useRef, useEffect } from "react";
import Login from "./Login";
import Register from "./Register";
import { useRouter } from "next/navigation";

export default function Home() {
  const [view, setView] = useState<"home" | "login" | "register">("home");
  const [hasToken, setHasToken] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Check for JWT on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setHasToken(true);
  }, []);

  // Scroll to form when view changes
  useEffect(() => {
    if (view !== "home" && formRef.current) {
      const offset = 50;
      const top =
        formRef.current.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [view]);

  const handleContinue = () => {
    // Navigate or perform an action with the token
    router.push("/chatbot");
  };

  return (
    <div className="w-full bg-gray-950 text-white flex flex-col">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col md:flex-row items-center justify-between px-8 md:px-16 py-16 gap-10">
        <div className="flex-1 flex flex-col gap-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            SaMMy – AI Powered Social Media Manager
          </h1>
          <p className="text-gray-400 text-lg sm:text-xl max-w-xl leading-relaxed">
            Generate, schedule, and post engaging content across multiple
            platforms — all from one place.
          </p>
          <div className="flex gap-4 mt-6">
            {!hasToken ? (
              <>
                <button
                  onClick={() => setView("login")}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all text-white font-semibold shadow-md"
                >
                  Login
                </button>
                <button
                  onClick={() => setView("register")}
                  className="px-6 py-3 rounded-xl border border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white transition-all font-semibold shadow-md"
                >
                  Register
                </button>
              </>
            ) : (
              <button
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-3 rounded-3xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center min-w-[90px] shadow-md"
                onClick={handleContinue}
              >
                Continue
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex justify-center items-center">
          <img
            src="/SHome.jpg"
            alt="SaMMy AI Bot"
            className="w-80 md:w-96 rounded-md shadow-lg"
          />
        </div>
      </section>

      {/* Login/Register Form Section */}
      {!hasToken && view !== "home" && (
        <div
          ref={formRef}
          className="px-8 md:px-16 py-16 mb-20 max-w-xl mx-auto flex flex-col gap-8"
        >
          {view === "login" && (
            <Login
              onSwitchToRegister={() => setView("register")}
              onLoginSuccess={() => setHasToken(true)}
            />
          )}
          {view === "register" && (
            <Register
              onSwitchToLogin={() => setView("login")}
              onRegisterSuccess={() => setHasToken(true)}
            />
          )}
        </div>
      )}

      {/* Features Section */}
      <section className="py-16 px-8 md:px-16 bg-gray-900/10 backdrop-blur-sm">
        <h2 className="text-3xl font-bold mb-12 text-center">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col gap-4 text-center">
            <h3 className="font-bold text-xl">AI Content Generation</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Generate engaging posts, tweets, and threads using AI tailored for
              your audience.
            </p>
          </div>
          <div className="flex flex-col gap-4 text-center">
            <h3 className="font-bold text-xl">Schedule & Automate</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Plan your content ahead of time and post automatically across
              platforms.
            </p>
          </div>
          <div className="flex flex-col gap-4 text-center">
            <h3 className="font-bold text-xl">Multi-Platform Integration</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Connect your Slack Workspace, Twitter/X, and Facebook accounts and
              manage everything from one dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-8 md:px-16 flex flex-col items-center text-center gap-6">
        <h2 className="text-3xl font-bold">Get Started Today</h2>
        <p className="text-gray-400 max-w-lg leading-relaxed">
          Experience effortless social media management with SaMMy. Sign up now
          and transform your online presence.
        </p>
        {!hasToken && (
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setView("register")}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all text-white font-semibold shadow-md"
            >
              Register
            </button>
            <button
              onClick={() => setView("login")}
              className="px-6 py-3 rounded-xl border border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white transition-all font-semibold shadow-md"
            >
              Login
            </button>
          </div>
        )}
      </section>

      <footer className="p-6 text-center text-gray-500 border-t border-gray-800">
        &copy; {new Date().getFullYear()} SaMMy. All rights reserved.
      </footer>
    </div>
  );
}
