import { Server } from "../src";

const app = new Server(3000)
  .setCors({ origin: ["*"] })
  .setSwagger(true)
  .setRateLimit({
    limit: 10,
    windowMs: 10 * 1000,
  })
  .setViews({
    dir: "./example/views",
  });

app.init();
