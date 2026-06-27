const SUPPORTED_GRAPH_API_VERSIONS = new Set(["20.0", "21.0", "22.0", "23.0", "24.0", "25.0"]);

export const graphApiVersionError = "请输入 Graph API 版本，例如 v25.0";

export function normalizeGraphApiVersion(input: string): string | null {
  const value = input.trim().toLowerCase();
  const version = value.startsWith("v") ? value.slice(1) : value;
  if (!/^\d+\.\d+$/.test(version)) return null;
  if (!SUPPORTED_GRAPH_API_VERSIONS.has(version)) return null;
  return `v${version}`;
}
