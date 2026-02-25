export function generateErrorOverlayHtml(
  logs: any[],
  hmrScript: string = "",
): string {
  const errCount = logs.length;

  const errorBlocks = logs
    .map((log: any) => {
      const rawMsg = log?.message || log?.toString() || "Unknown error";
      const message = rawMsg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const file = log?.position?.file
        ? log.position.file.replace(/\\/g, "/")
        : "unknown";
      const line = log?.position?.line || 0;
      const col = log?.position?.column || 0;
      const lineText = log?.position?.lineText
        ? log.position.lineText.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        : "";

      const carret = col > 0 ? " ".repeat(col - 1) + "^" : "";

      return `
      <div class="px-6 py-5 border-b border-gray-100 last:border-b-0">
        <div class="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Error Client</div>
        <h2 class="text-xl font-bold text-red-600 mb-2">${message}</h2>
        
        ${
          file !== "unknown"
            ? `<div class="font-mono text-sm font-semibold mb-4 text-gray-800">${file.split("/").pop()}:${line}:${col}</div>`
            : ""
        }
        
        ${
          lineText
            ? `
        <div class="bg-gray-50 p-4 rounded-md font-mono text-sm overflow-x-auto border border-gray-200">
          <div class="flex gap-4">
            <span class="text-gray-400 select-none">${line}</span>
            <span class="text-gray-800 whitespace-pre">${lineText}</span>
          </div>
          ${
            carret
              ? `
          <div class="flex gap-4">
            <span class="text-transparent select-none">${line}</span>
            <span class="text-red-500 font-bold whitespace-pre">${carret}</span>
          </div>`
              : ""
          }
        </div>
        `
            : ""
        }
        
        ${
          file !== "unknown"
            ? `<div class="mt-2 text-xs text-gray-400 font-mono">${file}</div>`
            : ""
        }
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EWB Build Error</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Custom scrollbar for pre */
    ::-webkit-scrollbar { height: 8px; width: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  </style>
</head>
<body class="bg-gray-100 text-gray-800 font-sans min-h-screen">
  <div id="ewb-error-root" class="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-500/30 backdrop-blur-sm p-4 w-full h-full">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 ring-1 ring-black/5">
      
      <!-- Top header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 md:bg-gray-50/50">
        <div class="flex items-center gap-2 text-red-600 font-medium text-sm">
          <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
          </svg>
          <span>${errCount} error${errCount !== 1 ? "s" : ""} on this page</span>
        </div>
        <button onclick="document.getElementById('ewb-error-root').style.display='none'" class="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 focus:outline-none">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      
      <!-- Scrollable Error Body -->
      <div class="overflow-y-auto flex-1 bg-white">
        ${errorBlocks}
      </div>
      
      <!-- Footer -->
      <div class="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div class="text-xs text-gray-500 font-medium flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Awaiting file saves...
        </div>
        <span class="text-xs text-gray-400 font-medium">powered by <b class="text-gray-700">Express Web Server Base</b></span>
      </div>
      
    </div>
  </div>
  ${hmrScript}
</body>
</html>`;
}
