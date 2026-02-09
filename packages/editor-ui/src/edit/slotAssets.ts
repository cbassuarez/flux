import type { AssetItem } from "./docService";

export function assetPreviewUrl(asset: AssetItem): string {
  if (asset.id) return `/assets/${encodeURIComponent(asset.id)}`;
  if (asset.path) return `/asset?src=${encodeURIComponent(asset.path)}`;
  return "";
}
