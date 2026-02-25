import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function generateErrorOverlayHtml(
  logs: any[],
  hmrScript: string = "",
): string {
  const errCount = logs.length;

  const htmlContent = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>EWB Build Error</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Custom scrollbar */
              ::-webkit-scrollbar { height: 8px; width: 8px; }
              ::-webkit-scrollbar-track { background: transparent; }
              ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
              ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
              body { font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"; }
            `,
          }}
        />
      </head>
      <body className="bg-gray-100/50 text-gray-800 h-screen w-screen overflow-hidden">
        <div
          id="ewb-error-root"
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-12 sm:p-4 sm:items-center bg-white/20 sm:bg-white/40 sm:backdrop-blur-[2px] w-full h-full"
        >
          <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-2xl flex flex-col overflow-hidden border border-gray-200 ring-1 ring-black/5">
            {/* Top header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2 text-gray-800 font-semibold text-[15px]">
                <svg
                  className="w-6 h-6 shrink-0 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="tracking-tight">
                  {errCount} error{errCount !== 1 ? "s" : ""} on this page
                </span>
              </div>
              <div className="flex items-center gap-4 text-[13px] font-medium text-gray-400">
                <span className="cursor-pointer items-center gap-1.5 hover:text-gray-600 transition-colors hidden sm:flex">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.05.05 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Want help?
                </span>
                <button
                  {...({
                    onclick:
                      "document.getElementById('ewb-error-root').style.display='none'",
                  } as any)}
                  className="text-gray-400 hover:text-gray-500 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full focus:outline-none w-6 h-6 flex items-center justify-center"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Error Body */}
            <div className="overflow-y-auto flex-1 max-h-[70vh] bg-white text-left">
              {logs.map((log: any, idx: number) => {
                const rawMsg =
                  log?.message || log?.toString() || "Unknown error";
                const message = rawMsg;
                const file = log?.position?.file
                  ? log.position.file.replace(/\\/g, "/")
                  : "unknown";
                const line = log?.position?.line || 0;
                const col = log?.position?.column || 0;
                const lineText = log?.position?.lineText || "";

                const carret = col > 0 ? " ".repeat(col - 1) + "^" : "";

                return (
                  <div
                    key={idx}
                    className="px-6 py-5 border-b border-gray-100 last:border-b-0 bg-white"
                  >
                    <div className="text-[11px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">
                      Error CLIENT
                    </div>
                    <h2 className="text-xl font-bold text-red-600 mb-2">
                      {message}
                    </h2>

                    {file !== "unknown" && (
                      <div className="font-bold text-[15px] mb-4 text-gray-900">
                        {file.split("/").pop()}:{line}:{col}
                      </div>
                    )}

                    {lineText && (
                      <div className="font-mono text-[13px] leading-relaxed overflow-x-auto text-gray-800">
                        <div className="flex group">
                          <span className="text-gray-400 select-none w-8 text-right pr-4">
                            {line}
                          </span>
                          <span className="whitespace-pre group-hover:bg-red-50 transition-colors">
                            {lineText}
                          </span>
                        </div>
                        {carret && (
                          <div className="flex">
                            <span className="text-transparent select-none w-8 text-right pr-4">
                              {line}
                            </span>
                            <span className="text-red-500 font-bold whitespace-pre">
                              {carret}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-[#fafafa] border-t border-gray-200 flex items-center justify-between">
              <button className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-1">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy as markdown
              </button>
              <div className="text-[12px] text-gray-400 font-semibold tracking-wide flex items-center gap-1.5">
                powered by{" "}
                <span className="text-gray-900 text-[14px] font-black tracking-tight flex items-center gap-1">
                  Bun{" "}
                  <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-sm ml-0.5 leading-none shadow-sm">
                    EWB
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: hmrScript }} />
      </body>
    </html>,
  );

  // We add <!DOCTYPE html> explicitly because renderToStaticMarkup doesn't include it.
  return `<!DOCTYPE html>\n` + htmlContent;
}
