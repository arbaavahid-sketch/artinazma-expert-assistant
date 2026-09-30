/**
 * Next applies `basePath` to pages, links and imported assets, but not to
 * paths written as plain strings. When the assistant runs as a zone of the
 * Artin Azma holding hub (ZONE_BASE_PATH=/ai) those need the prefix
 * themselves. Standalone, in the Android build and in the desktop build the
 * prefix is empty and nothing changes.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_ZONE_BASE_PATH || "";

export function withBasePath(path: string): string {
  if (!BASE_PATH || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
