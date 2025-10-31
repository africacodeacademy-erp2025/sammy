"use client";
import React, { useState, useRef, useEffect } from "react";
import Login from "./Login";
import Register from "./Register";
import { useRouter } from "next/navigation";
import PricingCard from "./UI/PricingCard";
import FeatureCard from "./UI/FeatureCard";
import { Plan } from "../Types/Plan";

export default function Home() {
  const [view, setView] = useState<"home" | "login" | "register">("home");
  const [hasToken, setHasToken] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch plans from database
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch("/api/plans");
        const data = await response.json();
        if (data.success && data.plans) {
          setPlans(data.plans);
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Check for JWT on mount and verify it's valid
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setHasToken(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          setHasToken(true);
        } else {
          localStorage.removeItem("token");
          setHasToken(false);
        }
      } catch (error) {
        localStorage.removeItem("token");
        setHasToken(false);
      }
    };

    verifyToken();
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
    router.push("/chatbot");
  };

  return (
    <div className="w-full bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950 text-white flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex flex-col md:flex-row items-center justify-between px-6 md:px-20 py-20 gap-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-700/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-2xl animate-pulse" />
        </div>
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-10 z-10">
          <div className="flex-1 flex flex-col gap-8">
            <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight drop-shadow-xl">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                SaMMy
              </span>
              <span className="block text-2xl sm:text-3xl font-bold mt-2 text-gray-200">
                AI Powered Social Media Manager
              </span>
            </h1>
            <p className="text-gray-300 text-xl sm:text-2xl max-w-2xl leading-relaxed">
              Effortlessly create, schedule, and post engaging content across
              all your platforms.{" "}
              <span className="text-purple-300 font-semibold">
                Grow your brand
              </span>{" "}
              with the power of AI.
            </p>
            <div className="flex gap-4 mt-6">
              {!hasToken ? (
                <button
                  onClick={() => setView("login")}
                  className="px-6 py-2 rounded-3xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all text-white font-bold text-base shadow-lg"
                >
                  Get Started
                </button>
              ) : (
                <button
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-3xl hover:from-blue-600 hover:to-purple-600 transition-all font-bold text-base shadow-lg flex items-center justify-center min-w-[120px]"
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
              className="w-80 md:w-96 rounded-2xl shadow-2xl border-4 border-purple-700/30"
            />
          </div>
        </div>
      </section>

      {/* Login/Register Form Section */}
      {!hasToken && view !== "home" && (
        <div
          ref={formRef}
          className="px-6 md:px-20 py-16 mb-20 max-w-xl mx-auto flex flex-col gap-8"
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
              selectedPlanId={selectedPlanId ?? undefined}
            />
          )}
        </div>
      )}

      {/* Features Section */}
      <section className="py-20 px-6 md:px-20 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-16 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-lg">
            Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <FeatureCard
              title="AI Content Generation"
              description="Generate engaging posts, tweets, and threads using AI tailored for your audience. Save time and boost creativity."
              gradientFrom="blue-500"
              gradientTo="purple-500"
              icon={
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                  <path
                    fill="white"
                    d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m12.728 0l-1.414-1.414M6.05 6.05L4.636 4.636"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="5"
                    stroke="white"
                    strokeWidth="2"
                  />
                </svg>
              }
            />

            <FeatureCard
              title="Schedule & Automate"
              description="Plan your content ahead of time and post automatically across platforms. Never miss a moment."
              gradientFrom="purple-500"
              gradientTo="pink-500"
              icon={
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                  <path
                    fill="white"
                    d="M17 2a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10zm-1 2H8v16h8V4zm-4 8v4m0-4h2m-2 0H9"
                  />
                </svg>
              }
            />

            <FeatureCard
              title="Multi-Platform Integration"
              description="Connect Slack, Twitter/X, and Facebook accounts. Let SaMMy manage everything with just a single prompt."
              gradientFrom="blue-500"
              gradientTo="pink-500"
              icon={
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                  <path
                    fill="white"
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14.93V17a1 1 0 0 1-2 0v-2.07a8.001 8.001 0 0 1-6.93-6.93H7a1 1 0 0 1 0-2H4.07A8.001 8.001 0 0 1 12 4.07V7a1 1 0 0 1 2 0v2.93a8.001 8.001 0 0 1 6.93 6.93H17a1 1 0 0 1 0 2h2.93A8.001 8.001 0 0 1 13 16.93z"
                  />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="plans" className="py-20 px-6 md:px-20 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-16 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-lg">
            Choose Your Plan
          </h2>
          {loading ? (
            <div className="flex justify-center items-center h-[500px]">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <PricingCard
                  key={plan.planId}
                  type={plan.name.split(" ")[0].toUpperCase()}
                  title={plan.name}
                  price={`$${plan.price.toFixed(2)}`}
                  description={plan.description}
                  features={plan.features.map((feature) => ({ text: feature }))}
                  buttonText={
                    plan.planId === 2
                      ? "Upgrade to Pro"
                      : plan.planId === 3
                      ? "Business Account"
                      : "Get Started"
                  }
                  isPopular={plan.planId === 2}
                  gradientFrom={plan.planId === 2 ? "purple-500" : "blue-500"}
                  gradientTo={
                    plan.planId === 2
                      ? "pink-500"
                      : plan.planId === 3
                      ? "pink-500"
                      : "purple-500"
                  }
                  planId={plan.planId}
                  onSelectPlan={(id) => {
                    setSelectedPlanId(id);
                    if (view !== "register") {
                      setView("register");
                    }
                    if (formRef.current) {
                      const offset = 50;
                      const top =
                        formRef.current.getBoundingClientRect().top +
                        window.scrollY -
                        offset;
                      window.scrollTo({ top, behavior: "smooth" });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-6 md:px-20 flex flex-col items-center text-center gap-8 bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-lg">
            Get Started Today
          </h2>
          <p className="text-gray-300 max-w-xl text-lg leading-relaxed">
            Experience effortless social media management with{" "}
            <span className="font-bold text-purple-300">SaMMy</span>. Sign up
            now and transform your online presence with the power of AI.
          </p>
          {!hasToken && (
            <div className="flex gap-6 mt-4">
              <button
                onClick={() => setView("login")}
                className="px-6 py-2 rounded-3xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all text-white font-bold text-base shadow-lg"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="p-8 text-center text-gray-400 border-t border-gray-700/50 bg-gray-950 mt-auto flex flex-col items-center gap-4">
        <div className="flex gap-6 justify-center mb-2">
          <a
            href="https://www.facebook.com/share/1BAr6jwHjh/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="hover:text-blue-400"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="inline-block"
            >
              <path d="M22.675 0h-21.35C.595 0 0 .592 0 1.326v21.348C0 23.408.595 24 1.325 24h11.495v-9.294H9.691v-3.622h3.129V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.797.143v3.24l-1.918.001c-1.504 0-1.797.715-1.797 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.405 24 24 23.408 24 22.674V1.326C24 .592 23.405 0 22.675 0" />
            </svg>
          </a>
          <a
            href="https://x.com/sammy_agent_ai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
            className="hover:text-sky-400"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="inline-block"
            >
              <path d="M24 4.557a9.83 9.83 0 0 1-2.828.775 4.932 4.932 0 0 0 2.165-2.724c-.951.555-2.005.959-3.127 1.184A4.916 4.916 0 0 0 16.616 3c-2.717 0-4.92 2.206-4.92 4.917 0 .386.044.762.127 1.124C7.728 8.77 4.1 6.797 1.671 3.149c-.423.722-.666 1.561-.666 2.475 0 1.708.87 3.216 2.188 4.099a4.904 4.904 0 0 1-2.229-.616c-.054 2.281 1.581 4.415 3.949 4.89a4.936 4.936 0 0 1-2.224.084c.627 1.956 2.444 3.377 4.6 3.417A9.867 9.867 0 0 1 0 21.543a13.94 13.94 0 0 0 7.548 2.212c9.058 0 14.009-7.513 14.009-14.009 0-.213-.005-.425-.014-.636A10.025 10.025 0 0 0 24 4.557z" />
            </svg>
          </a>
          <a
            href="https://www.linkedin.com/company/sammy-ai-agent/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="hover:text-blue-600"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="inline-block"
            >
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11.75 20h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm15.25 11.268h-3v-5.604c0-1.337-.026-3.063-1.868-3.063-1.868 0-2.156 1.459-2.156 2.967v5.7h-3v-10h2.881v1.367h.041c.401-.761 1.379-1.563 2.838-1.563 3.036 0 3.6 2.001 3.6 4.601v5.595z" />
            </svg>
          </a>
        </div>
        <div>
          &copy; {new Date().getFullYear()}{" "}
          <span className="font-bold text-purple-300">SaMMy</span>. All rights
          reserved.
        </div>
        <div className="mt-2 text-sm text-gray-400 flex flex-col items-center gap-1">
          <span>
            Developers:
            <a
              href="mailto:polokonkolanyane92@gmail.com"
              className="underline hover:text-purple-300 ml-1"
            >
              polokonkolanyane92@gmail.com
            </a>
            {" | "}
            <a
              href="mailto:pusetro142@gmail.com"
              className="underline hover:text-purple-300"
            >
              pusetro142@gmail.com
            </a>
          </span>
          <span>
            Company:{" "}
            <a
              href="https://africacode.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-400"
            >
              africacode.org
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
