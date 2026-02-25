export const hmrClientScript = `
if (typeof window !== "undefined") {
  window.__EWB_HMR__ = {
    data: {},
    _listeners: {},
    _dispose: [],
    _prune: [],
    _assetHashes: {},
    accept: (cb) => { 
      if (cb) window.__EWB_HMR__.on("bun:afterUpdate", () => cb()); 
    },
    dispose: (cb) => { window.__EWB_HMR__._dispose.push(cb); },
    prune: (cb) => { window.__EWB_HMR__._prune.push(cb); },
    decline: () => {},
    invalidate: () => window.location.reload(),
    on: (event, cb) => {
      if (!window.__EWB_HMR__._listeners[event]) window.__EWB_HMR__._listeners[event] = [];
      window.__EWB_HMR__._listeners[event].push(cb);
    },
    off: (event, cb) => {
      if (window.__EWB_HMR__._listeners[event]) {
        window.__EWB_HMR__._listeners[event] = window.__EWB_HMR__._listeners[event].filter((f) => f !== cb);
      }
    },
    _emit: async (event, data) => {
      if (window.__EWB_HMR__._listeners[event]) {
        for (const cb of window.__EWB_HMR__._listeners[event]) await cb(data);
      }
    }
  };

  if (window.io) {
    const socket = window.io();
    socket.on("connect", () => {
      console.log("[EWB] HMR connected via Socket.IO");
      window.__EWB_HMR__._emit("bun:ws:connect");
    });
    
    socket.on("disconnect", () => {
      console.log("[EWB] HMR disconnected");
      window.__EWB_HMR__._emit("bun:ws:disconnect");
    });
    
    socket.on("hmr:reload", async () => {
      console.log("[EWB] Change detected, fetching updates...");
      try {
        await window.__EWB_HMR__._emit("bun:beforeUpdate");
        
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("_hmr", Date.now().toString());
        const res = await fetch(currentUrl.toString());
        if (!res.ok) throw new Error("Fetch failed");
        
        const html = await res.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, "text/html");
        
        const errorRoot = newDoc.getElementById("ewb-error-root");
        if (errorRoot) {
           const logsMatch = html.match(/__EWB_ERROR_LOGS__\\s*=\\s*(.*?);/s);
           if (logsMatch && logsMatch[1]) {
              try {
                 const logs = JSON.parse(logsMatch[1]);
                 if (!document.getElementById("ewb-error-root")) {
                    const div = document.createElement("div");
                    div.id = "ewb-error-root";
                    document.body.appendChild(div);
                 }
                 
                 if (window.renderEWBErrorOverlay) {
                    window.renderEWBErrorOverlay(logs);
                 } else {
                    if (!document.getElementById("ewb-error-script")) {
                       window.__EWB_ERROR_LOGS__ = logs;
                       const script = document.createElement("script");
                       script.type = "module";
                       script.id = "ewb-error-script";
                       script.src = "/_ebw_error_overlay.js";
                       document.head.appendChild(script);
                    }
                 }
              } catch (e) {
                 console.error("Failed to parse EWB error logs", e);
              }
           }
           console.error("[EWB] Build fails. See overlay for details.");
           return;
        } else {
           const existingOverlay = document.getElementById("ewb-error-root");
           if (existingOverlay) {
              if (window._ewbErrorRoot) {
                 window._ewbErrorRoot.unmount();
                 window._ewbErrorRoot = undefined;
              }
              existingOverlay.remove();
           }
        }
        
        const newStyles = Array.from(newDoc.querySelectorAll("link[rel='stylesheet']"));
        for (const s of newStyles) {
          const href = s.getAttribute("href")?.split("?")[0];
          if (!href) continue;
          
          const cacheUrl = href + (href.includes("?") ? "&" : "?") + "_hmr=" + Date.now();
          const cssRes = await fetch(cacheUrl);
          const cssText = await cssRes.text();
          
          if (window.__EWB_HMR__._assetHashes[href] !== cssText) {
             window.__EWB_HMR__._assetHashes[href] = cssText;
             
             const existing = document.querySelector(\`link[rel='stylesheet'][href^='\${href}']\`);
             const newLink = document.createElement("link");
             newLink.rel = "stylesheet";
             newLink.href = cacheUrl;
             
             if (existing) {
               existing.parentNode.replaceChild(newLink, existing);
             } else {
               document.head.appendChild(newLink);
             }
          }
        }
        
        const scripts = Array.from(newDoc.querySelectorAll("script[type='module'][src]"));
        let updated = false;
        
        for (const script of scripts) {
          const src = script.getAttribute("src")?.split("?")[0];
          if (src && !src.includes("/socket.io/") && !src.includes("/_ebw_hmr.js")) {
            const cacheUrl = src + (src.includes("?") ? "&" : "?") + "_hmr=" + Date.now();
            const jsRes = await fetch(cacheUrl);
            const jsText = await jsRes.text();
            
            if (window.__EWB_HMR__._assetHashes[src] !== jsText) {
              window.__EWB_HMR__._assetHashes[src] = jsText;
              
              for (const cb of window.__EWB_HMR__._dispose) await cb();
              window.__EWB_HMR__._dispose = [];
              
              await import(cacheUrl);
              updated = true;
            }
          }
        }
        
        if (updated) {
          await window.__EWB_HMR__._emit("bun:afterUpdate");
        } else {
          for (const cb of window.__EWB_HMR__._dispose) await cb();
          window.__EWB_HMR__._dispose = [];
        }
      } catch (err) {
        console.error("[EWB] HMR Update failed, falling back to full context reload", err);
        await window.__EWB_HMR__._emit("bun:beforeFullReload");
        await window.__EWB_HMR__._emit("bun:error", err);
        window.location.reload();
      }
    });
  }
}
`;
