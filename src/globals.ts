import type { Express } from "express";

declare global {
  var servers: Map<string, Express>;
}

export {};
