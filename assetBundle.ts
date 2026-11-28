import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/** Bundle the app's own CDN artwork so external hosts do not need the asset-serving proxy. */
export function bundleAssets(): Plugin {
  return {
    name: "bundle-project-artwork",
    apply: "build",
    async generateBundle() {
      const directory = path.resolve("src/assets");
      const files = (await fs.readdir(directory)).filter(file => file.endsWith(".asset.json"));
      await Promise.all(files.map(async file => {
        const asset = JSON.parse(await fs.readFile(path.join(directory, file), "utf8"));
        if (typeof asset.url !== "string" || !asset.url.startsWith("/__l5e/assets-v1/")) return;
        const response = await fetch(new URL(asset.url, "https://techwizardhub.lovable.app"), { signal: AbortSignal.timeout(30000) });
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Artwork unavailable: ${file}`);
        this.emitFile({ type: "asset", fileName: asset.url.slice(1), source: new Uint8Array(await response.arrayBuffer()) });
      }));
    },
  };
}