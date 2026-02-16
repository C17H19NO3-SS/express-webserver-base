import tailwindPlugin from "bun-plugin-tailwind";
import type { TailwindOptions } from "../Decorations/Tailwind";
import fs from "fs";
import path from "path";

export class ServeMemoryStore {
  private static _instance: ServeMemoryStore;
  private _assets: Map<string, { type: string; content: Uint8Array }> =
    new Map();
  private _htmlCache: Map<string, string> = new Map();
  private _cacheDir = path.join(process.cwd(), ".ebw-cache");
  private _devMode = false;
  private _watchers: Map<string, fs.FSWatcher> = new Map();
  private _listeners: (() => void)[] = [];

  private constructor() {
    if (!fs.existsSync(this._cacheDir)) {
      try {
        fs.mkdirSync(this._cacheDir, { recursive: true });
      } catch (e) {
        // Fallback if we can't create directory
      }
    }
  }

  public static get instance(): ServeMemoryStore {
    if (!ServeMemoryStore._instance) {
      ServeMemoryStore._instance = new ServeMemoryStore();
    }
    return ServeMemoryStore._instance;
  }

  public setDevMode(enabled: boolean) {
    this._devMode = enabled;
  }

  public onRebuild(listener: () => void) {
    this._listeners.push(listener);
  }

  private notify() {
    this._listeners.forEach((l) => l());
  }

  public getAsset(path: string) {
    return this._assets.get(path);
  }

  private getCacheKey(htmlPath: string, options: TailwindOptions): string {
    return (
      htmlPath +
      (options.enable ? ":tw" : "") +
      (options.plugins ? ":" + options.plugins.length : "")
    );
  }

  private async loadFromDisk(cacheKey: string): Promise<string | null> {
    const hash = Bun.hash(cacheKey).toString(16);
    const cacheFile = path.join(this._cacheDir, `${hash}.json`);

    if (fs.existsSync(cacheFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
        this._htmlCache.set(cacheKey, data.html);

        for (const [webPath, asset] of Object.entries(data.assets)) {
          this._assets.set(webPath, {
            type: (asset as any).type,
            content: Buffer.from((asset as any).content, "base64"),
          });
        }
        return data.html;
      } catch (e) {
        console.error("Error loading cache from disk:", e);
      }
    }
    return null;
  }

  private setupWatcher(htmlPath: string, options: TailwindOptions) {
    const cacheKey = this.getCacheKey(htmlPath, options);
    if (this._watchers.has(cacheKey)) return;

    const absolutePath = path.resolve(process.cwd(), htmlPath);
    const watchDir = path.dirname(absolutePath);

    const watcher = fs.watch(
      watchDir,
      { recursive: true },
      async (event, filename) => {
        if (!filename) return;

        // Ignore common noise
        if (
          filename.includes("node_modules") ||
          filename.includes(".git") ||
          filename.includes(".ebw-cache")
        )
          return;

        console.log(`[HMR] Change detected in ${filename}. Rebuilding...`);

        // Clear cache for this entry
        this._htmlCache.delete(cacheKey);
        // Clear disk cache by deleting file
        const hash = Bun.hash(cacheKey).toString(16);
        const cacheFile = path.join(this._cacheDir, `${hash}.json`);
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
        }

        try {
          await this.buildAndCache(htmlPath, options);
          this.notify();
        } catch (e) {
          console.error("[HMR] Rebuild failed:", e);
        }
      },
    );

    this._watchers.set(cacheKey, watcher);
  }

  public async buildAndCache(
    htmlPath: string,
    options: TailwindOptions = { enable: false, plugins: [] },
  ): Promise<string> {
    const cacheKey = this.getCacheKey(htmlPath, options);

    // 1. Check Memory Cache
    if (this._htmlCache.has(cacheKey)) {
      return this._htmlCache.get(cacheKey)!;
    }

    // 2. Check Disk Cache (unless in dev mode and we want to ensure fresh start,
    // but usually disk cache is fine as watcher will invalidate it)
    const diskHtml = await this.loadFromDisk(cacheKey);
    if (diskHtml) {
      if (this._devMode) {
        this.setupWatcher(htmlPath, options);
      }
      return diskHtml;
    }

    // 3. Perform Build
    try {
      const plugins = [...(options.plugins || [])];

      if (options.enable) {
        plugins.push(tailwindPlugin);
      }

      const build = await Bun.build({
        entrypoints: [htmlPath],
        target: "browser",
        minify: !this._devMode,
        naming: "[name]-[hash].[ext]",
        publicPath: "/",
        plugins: plugins,
      });

      if (!build.success) {
        console.error("Build failed:", build.logs);
        throw new Error("Build failed");
      }

      let htmlContent = "";
      const currentBuildAssets: Record<
        string,
        { type: string; content: string }
      > = {};

      for (const output of build.outputs) {
        const content = await output.arrayBuffer();
        const uint8 = new Uint8Array(content);
        const filename = output.path.split(/[/\\]/).pop();
        const webPath = "/" + filename;

        if (output.type === "text/html" || filename?.endsWith(".html")) {
          htmlContent = await output.text();
        } else {
          const asset = {
            type: output.type,
            content: uint8,
          };
          this._assets.set(webPath, asset);

          currentBuildAssets[webPath] = {
            type: output.type,
            content: Buffer.from(uint8).toString("base64"),
          };
        }
      }

      // Inject HMR/Reload script in dev mode
      if (this._devMode) {
        const reloadScript = `
<script id="ebw-hmr-script">
  (function() {
    const sse = new EventSource('/ebw-hmr');
    sse.onmessage = (e) => {
      if (e.data === 'reload') {
        console.log('[HMR] Reloading page...');
        location.reload();
      }
    };
    sse.onerror = () => {
      console.warn('[HMR] Connection lost. Attempting to reconnect...');
    };
  })();
</script>
`;
        if (htmlContent.includes("</body>")) {
          htmlContent = htmlContent.replace(
            "</body>",
            `${reloadScript}</body>`,
          );
        } else {
          htmlContent += reloadScript;
        }

        this.setupWatcher(htmlPath, options);
      }

      // 4. Save to Memory and Disk
      this._htmlCache.set(cacheKey, htmlContent);

      const hash = Bun.hash(cacheKey).toString(16);
      const cacheFile = path.join(this._cacheDir, `${hash}.json`);
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({
          html: htmlContent,
          assets: currentBuildAssets,
        }),
      );

      return htmlContent;
    } catch (error) {
      console.error("Serve build error:", error);
      throw error;
    }
  }
}
