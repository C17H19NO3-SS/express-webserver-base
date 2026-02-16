import tailwindPlugin from "bun-plugin-tailwind";

export class ServeMemoryStore {
  private static _instance: ServeMemoryStore;
  private _assets: Map<string, { type: string; content: Uint8Array }> =
    new Map();
  private _htmlCache: Map<string, string> = new Map();

  private constructor() {}

  public static get instance(): ServeMemoryStore {
    if (!ServeMemoryStore._instance) {
      ServeMemoryStore._instance = new ServeMemoryStore();
    }
    return ServeMemoryStore._instance;
  }

  public getAsset(path: string) {
    // Remove leading slash for matching if stored without it, or normalize.
    // We will store with leading slash.
    return this._assets.get(path);
  }

  public async buildAndCache(
    htmlPath: string,
    enableTailwind = false,
  ): Promise<string> {
    const cacheKey = htmlPath + (enableTailwind ? ":tw" : "");
    if (this._htmlCache.has(cacheKey)) {
      return this._htmlCache.get(cacheKey)!;
    }

    try {
      const build = await Bun.build({
        entrypoints: [htmlPath],
        target: "browser",
        minify: true,
        naming: "[name]-[hash].[ext]", // Ensure unique names
        publicPath: "/", // Assets served from root
        plugins: [tailwindPlugin],
      });

      if (!build.success) {
        console.error("Build failed:", build.logs);
        throw new Error("Build failed");
      }

      let htmlContent = "";

      for (const output of build.outputs) {
        const content = await output.arrayBuffer();
        let text = await output.text(); // For HTML/CSS

        // output.path is the absolute path if we were writing, or the name.
        // With naming option, output.path usually contains the generated name.
        // For artifacts, we need to map the requested URL to this content.
        // output.kind gives us hint.

        // Parse the relative path (URL) from the output.
        // Since we didn't specify outdir, Bun might give us just the name or path relative to cwd.
        // However, with `publicPath: "/"`, the HTML imports will look like `/foo-hash.js`.
        // We need to store keys as `/foo-hash.js`.

        // Let's rely on the fact that `output.path` usually returns what would be written to disk.
        // We need the filename part.
        const filename = output.path.split(/[/\\]/).pop();
        const webPath = "/" + filename;

        if (output.type === "text/html" || filename?.endsWith(".html")) {
          htmlContent = text;
        } else {
          let finalContent = new Uint8Array(content);

          this._assets.set(webPath, {
            type: output.type,
            content: finalContent,
          });
        }
      }

      this._htmlCache.set(cacheKey, htmlContent);
      return htmlContent;
    } catch (error) {
      console.error("Serve build error:", error);
      throw error;
    }
  }
}
