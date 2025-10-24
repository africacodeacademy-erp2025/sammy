"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Shield, ArrowRight, LogOut } from 'lucide-react';

export default function DashboardSelect() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }

      const data = await response.json();
      const userData = data.user;
      
      // Check if user is admin
      const isAdmin = userData?.role === 'admin';
      
      // If not admin, redirect to chatbot
      if (!isAdmin) {
        router.push('/chatbot');
        return;
      }
      
      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateTo = (path: string) => {
    router.push(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-700/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-2xl animate-pulse" />
      </div>

      <div className="max-w-5xl w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              Welcome Back!
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            {user?.email}
          </p>
          {isAdmin && (
            <div className="mt-3 inline-flex items-center px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/50">
              <Shield className="w-4 h-4 mr-2 text-purple-400" />
              <span className="text-purple-300 font-semibold">
                Administrator
              </span>
            </div>
          )}
        </div>

        {/* Dashboard Options */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Chatbot Option */}
          <button
            onClick={() => navigateTo('/chatbot')}
            className="group bg-gray-800/50 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-10 text-left border-2 border-gray-700/50 hover:border-blue-500/50 transform hover:-translate-y-2 hover:scale-105"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl group-hover:scale-110 transition-transform shadow-lg">
                <MessageSquare className="w-10 h-10 text-white" />
              </div>
              <ArrowRight className="w-7 h-7 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-2 transition-all" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 transition-all">
              AI Chatbot
            </h2>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Create and manage social media posts with AI assistance. Schedule posts, get content suggestions, and streamline your workflow.
            </p>
            
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
                Post Creation
              </span>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm font-medium border border-purple-500/30">
                AI Assistant
              </span>
              <span className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-sm font-medium border border-pink-500/30">
                Scheduling
              </span>
            </div>
          </button>

          {/* Admin Dashboard Option - Only for Admins */}
          {isAdmin ? (
            <button
              onClick={() => navigateTo('/admin')}
              className="group bg-gradient-to-br from-purple-600/30 to-indigo-600/30 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-10 text-left border-2 border-purple-500/50 hover:border-purple-400 transform hover:-translate-y-2 hover:scale-105 relative overflow-hidden"
            >
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl group-hover:scale-110 transition-transform shadow-lg">
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  <ArrowRight className="w-7 h-7 text-purple-300 group-hover:text-white group-hover:translate-x-2 transition-all" />
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-3xl font-bold text-white">
                    Admin Dashboard
                  </h2>
                </div>
                <p className="text-purple-100 mb-6 leading-relaxed">
                  Manage users, view analytics, configure system settings, and oversee all platform operations with full control.
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium border border-white/30">
                    User Management
                  </span>
                  <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium border border-white/30">
                    Analytics
                  </span>
                  <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium border border-white/30">
                    Full Control
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="bg-gray-800/30 rounded-2xl shadow-xl p-10 border-2 border-gray-700/50 flex items-center justify-center">
              <div className="text-center">
                <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-semibold text-gray-400 mb-2">
                  Admin Access Required
                </h3>
                <p className="text-gray-500">
                  You need admin privileges to access the admin dashboard.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <div className="text-center mt-8">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-all font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
