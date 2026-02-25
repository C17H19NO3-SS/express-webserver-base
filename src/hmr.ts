import { io } from "socket.io-client";

if (typeof window !== "undefined") {
  const socket = io();

  socket.on("connect", () => {
    console.log("[EWB] HMR connected via Socket.IO");
  });

  socket.on("disconnect", () => {
    console.log("[EWB] HMR disconnected");
  });

  socket.on("hmr:reload", async () => {
    console.log("[EWB] Change detected, fetching updates...");
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("_hmr", Date.now().toString());

      const res = await fetch(currentUrl.toString());
      if (!res.ok) throw new Error("Fetch failed");
      const html = await res.text();

      const parser = new DOMParser();
      const newDoc = parser.parseFromString(html, "text/html");

      // Update Styles
      const newStyles = Array.from(
        newDoc.querySelectorAll("link[rel='stylesheet'], style"),
      );
      const oldStyles = Array.from(
        document.querySelectorAll("link[rel='stylesheet'], style"),
      );

      oldStyles.forEach((s) => s.remove());
      newStyles.forEach((s) => {
        if (s.tagName === "LINK") {
          const href = s.getAttribute("href");
          if (href)
            s.setAttribute(
              "href",
              href + (href.includes("?") ? "&" : "?") + "_hmr=" + Date.now(),
            );
        }
        document.head.appendChild(s.cloneNode(true));
      });

      // Update Body
      document.body.innerHTML = newDoc.body.innerHTML;

      // Re-run Scripts
      const scripts = Array.from(document.body.querySelectorAll("script"));
      for (const oldScript of scripts) {
        if (
          oldScript.innerHTML !== "" &&
          oldScript.innerHTML.includes("@synchjs/ewb/hmr")
        )
          continue;

        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => {
          if (attr.name === "src") {
            newScript.setAttribute(
              attr.name,
              attr.value +
                (attr.value.includes("?") ? "&" : "?") +
                "_hmr=" +
                Date.now(),
            );
          } else {
            newScript.setAttribute(attr.name, attr.value);
          }
        });

        newScript.text = oldScript.text;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      }
    } catch (err) {
      console.error(
        "[EWB] HMR Update failed, falling back to full context reload",
        err,
      );
      window.location.reload();
    }
  });
}
