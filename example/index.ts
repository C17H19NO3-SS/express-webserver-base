import { Server } from "../src";
import tailwindcssPlugin from "bun-plugin-tailwind";

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
  .setViewPlugins(tailwindcssPlugin);

app.init();
