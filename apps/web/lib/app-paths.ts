export const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.APP_BASE_PATH ?? "/ads");

export function appPath(path: string): string {
  if (isExternalPath(path)) return path;
  const normalizedPath = normalizePath(path);
  if (!appBasePath) return normalizedPath;
  if (normalizedPath === appBasePath || normalizedPath.startsWith(`${appBasePath}/`)) return normalizedPath;
  return `${appBasePath}${normalizedPath}`;
}

export function apiPath(path: `/api/${string}`): string {
  return appPath(path);
}

export function appRedirectUrl(baseUrl: string, path: string): URL {
  return new URL(appPath(path), baseUrl);
}

function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function isExternalPath(path: string): boolean {
  return /^https?:\/\//i.test(path) || path.startsWith("mailto:") || path.startsWith("tel:");
}
