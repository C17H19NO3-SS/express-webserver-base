import tailwindPlugin from "bun-plugin-tailwind";
import type { TailwindOptions } from "../Decorations/Tailwind";
import fs from "fs";
import path from "path";
import { load } from "cheerio";

export class ServeMemoryStore {
  private static _instance: ServeMemoryStore;
  private _assets: Map<string, { type: string; content: Uint8Array }> =
    new Map();
  private _htmlCache: Map<string, string> = new Map();
  private _cacheDir = path.join(process.cwd(), ".ebw-cache");
  private _devMode = false;
  private _watchers: Map<string, fs.FSWatcher> = new Map();
  private _listeners: ((data?: { html: string }) => void)[] = [];

  private constructor() {
    this.ensureCacheDir();
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this._cacheDir)) {
      try {
        fs.mkdirSync(this._cacheDir, { recursive: true });
      } catch (e) {
        // Fallback if we can't create directory
      }
    }
  }

  public clearCache() {
    if (fs.existsSync(this._cacheDir)) {
      try {
        const files = fs.readdirSync(this._cacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this._cacheDir, file));
        }
        // Silent clear
      } catch (e) {
        console.error("[Cache] Error clearing cache:", e);
      }
    }
    this._htmlCache.clear();
    this._assets.clear();
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

  public onRebuild(listener: (data?: { html: string }) => void) {
    this._listeners.push(listener);
  }

  private notify(data?: { html: string }) {
    this._listeners.forEach((l) => l(data));
  }

  public getAsset(rawPath: string) {
    // Basic path traversal protection
    const normalizedPath = path.posix.normalize(rawPath);
    if (normalizedPath.includes("..")) return undefined;
    return this._assets.get(normalizedPath);
  }

  private getCacheKey(htmlPath: string, options: TailwindOptions): string {
    return (
      htmlPath +
      (options.enable ? ":tw" : "") +
      (options.plugins ? ":" + options.plugins.length : "")
    );
  }

  private async loadFromDisk(cacheKey: string): Promise<string | null> {
    if (this._devMode) return null; // Skip disk cache in dev mode

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

        // Silent detect

        // Clear cache for this entry
        this._htmlCache.delete(cacheKey);
        // Clear disk cache by deleting file
        const hash = Bun.hash(cacheKey).toString(16);
        const cacheFile = path.join(this._cacheDir, `${hash}.json`);
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
        }

        try {
          const newHtml = await this.buildAndCache(htmlPath, options);
          this.notify({ html: newHtml });
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
    if (!this._devMode && this._htmlCache.has(cacheKey)) {
      return this._htmlCache.get(cacheKey)!;
    }

    // 2. Check Disk Cache
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
<script src="/socket.io/socket.io.js"></script>
<script id="ebw-hmr-script">
  (function() {
    const socket = io(window.location.origin);
    
    socket.on('rebuild', (data) => {
      if (!data || !data.html) return;
      console.log('[HMR] Rebuild detected. Hot swapping scripts...');
      
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(data.html, 'text/html');
      const newScripts = Array.from(newDoc.querySelectorAll('script[src]'))
        .filter(s => !s.id && s.getAttribute('src').includes('-')); // Find bundled scripts
        
      if (newScripts.length === 0) {
        console.warn('[HMR] No bundled scripts found in rebuild. Falling back to reload.');
        location.reload();
        return;
      }
      
      // Remove old bundled scripts
      const oldScripts = Array.from(document.querySelectorAll('script[src]'))
        .filter(s => !s.id && s.getAttribute('src').includes('-'));
      
      oldScripts.forEach(s => s.remove());
      
      // Add new scripts
      newScripts.forEach(s => {
        const script = document.createElement('script');
        Array.from(s.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
        document.body.appendChild(script);
      });
      
      console.log('[HMR] Hot swap complete!');
    });

    socket.on('reload', () => {
      console.log('[HMR] Hard reload signal received.');
      location.reload();
    });
    
    socket.on('disconnect', () => {
      console.warn('[HMR] Connection lost. Attempting to reconnect...');
    });
  })();
</script>
`;
        // In dev mode, we might want to prevent caching by appending a timestamp to asset links in the HTML
        const timestamp = Date.now();
        htmlContent = htmlContent.replace(
          /(\.js|\.css)(\?.*)?/g,
          `$1?t=${timestamp}`,
        );

        const $ = load(htmlContent);
        if ($("body").length > 0) {
          $("body").append(reloadScript);
        } else {
          $.root().append(reloadScript);
        }
        htmlContent = $.html();

        this.setupWatcher(htmlPath, options);
      }

      // 4. Save to Memory and Disk
      this._htmlCache.set(cacheKey, htmlContent);

      if (!this._devMode) {
        const hash = Bun.hash(cacheKey).toString(16);
        const cacheFile = path.join(this._cacheDir, `${hash}.json`);
        fs.writeFileSync(
          cacheFile,
          JSON.stringify({
            html: htmlContent,
            assets: currentBuildAssets,
          }),
        );
      }

      return htmlContent;
    } catch (error) {
      console.error("Serve build error:", error);
      throw error;
    }
  }
}
