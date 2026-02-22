import type { Server } from "./Server/Server";

declare interface global {
  servers: Server[];
}
