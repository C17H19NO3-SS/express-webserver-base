import { Server } from "../src";
import tailwindcssPlugin from "bun-plugin-tailwindcss";

const app = new Server(3000)
  .setCors({ origin: ["*"] })
  .setSwagger(true)
  .setRateLimit({
    limit: 10,
    windowMs: 10 * 1000,
  })
  .setViews({
    dir: "./example/views",
  })
  .setPlugins([tailwindcssPlugin()]);

app.init();
