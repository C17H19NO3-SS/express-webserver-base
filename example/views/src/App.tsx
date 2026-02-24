import React from "react";

export const App = () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-6 text-slate-200 antialiased font-sans">
      {/* Animated Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[0%] right-[0%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[100px] mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-slate-900/50 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-3xl p-10 mt-10 transform transition-all hover:scale-[1.01] hover:shadow-indigo-500/10">
        {/* Header Section */}
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-2">
            <svg
              className="w-8 h-8 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-indigo-300 via-white to-purple-300">
            EWB + React + Bun
          </h1>
          <p className="text-sm sm:text-base text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
            This dynamic view is powered natively by Express and compiled at
            lightning speed by Bun.build.
          </p>
        </div>

        {/* Status Dashboard */}
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="/users"
            target="_blank"
            className="group flex flex-col p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
                <svg
                  className="w-5 h-5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">API Module</h3>
            </div>
            <p className="text-xs text-slate-400 font-mono">/users</p>
          </a>

          <a
            href="/docs"
            target="_blank"
            className="group flex flex-col p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-fuchsia-500/20 transition-all">
                <svg
                  className="w-5 h-5 text-fuchsia-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Swagger UI</h3>
            </div>
            <p className="text-xs text-slate-400 font-mono">/docs</p>
          </a>
        </div>

        {/* Footer info */}
        <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span>Server Active</span>
          </div>
          <span>v1.3.0</span>
        </div>
      </div>
    </div>
  );
};
