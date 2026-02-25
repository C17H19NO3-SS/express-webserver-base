export function generateErrorOverlayHtml(
  logs: any[],
  hmrScript: string = "",
): string {
  const errCount = logs.length;
  // Safely serialize the logs payload for the frontend
  const logsJson = JSON.stringify(logs).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EWB Build Error \${errCount}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Custom scrollbar */
    ::-webkit-scrollbar { height: 8px; width: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
    body { font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"; }
  </style>
  <script>
    window.__EWB_ERROR_LOGS__ = \${logsJson};
  </script>
</head>
<body class="bg-gray-100/50 text-gray-800 h-screen w-screen overflow-hidden">
  
  <div id="ewb-error-root"></div>
  
  <!-- Mount the React Application -->
  <script type="module" src="/_ebw_error_overlay.js"></script>
  
  \${hmrScript}
</body>
</html>`;
}
