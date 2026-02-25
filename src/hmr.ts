import { io } from "socket.io-client";

if (typeof window !== "undefined") {
  const socket = io();

  socket.on("connect", () => {
    console.log("[EWB] HMR connected via Socket.IO");
  });

  socket.on("disconnect", () => {
    console.log("[EWB] HMR disconnected");
  });

  socket.on("hmr:reload", () => {
    console.log("[EWB] Change detected, reloading browser...");
    window.location.reload();
  });
}
