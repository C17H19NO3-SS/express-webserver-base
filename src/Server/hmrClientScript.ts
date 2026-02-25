export const hmrClientScript = `
if (typeof window !== "undefined") {
  window.__EWB_HMR__ = {
    data: {},
    _listeners: {},
    _dispose: [],
    _prune: [],
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
        for (const cb of window.__EWB_HMR__._dispose) await cb();
        window.__EWB_HMR__._dispose = [];
        
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("_hmr", Date.now().toString());
        const res = await fetch(currentUrl.toString());
        if (!res.ok) throw new Error("Fetch failed");
        
        const html = await res.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, "text/html");
        
        const newStyles = Array.from(newDoc.querySelectorAll("link[rel='stylesheet'], style"));
        const oldStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"));
        oldStyles.forEach((s) => s.remove());
        newStyles.forEach((s) => {
          if (s.tagName === "LINK") {
            const href = s.getAttribute("href");
            if (href) s.setAttribute("href", href + (href.includes("?") ? "&" : "?") + "_hmr=" + Date.now());
          }
          document.head.appendChild(s.cloneNode(true));
        });
        
        const scripts = Array.from(newDoc.querySelectorAll("script[type='module'][src]"));
        let updated = false;
        
        for (const script of scripts) {
          const src = script.getAttribute("src");
          if (src && !src.includes("/socket.io/")) {
            const importUrl = src + (src.includes("?") ? "&" : "?") + "_hmr=" + Date.now();
            await import(importUrl);
            updated = true;
          }
        }
        
        if (!updated) {
          window.location.reload();
        } else {
          await window.__EWB_HMR__._emit("bun:afterUpdate");
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
