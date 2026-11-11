export const dynamic = "force-dynamic";

export function GET() {
  const configuredCode = process.env.BAZAAR_LATEST_VERSION_CODE?.trim() ?? "";
  const versionCode = Number(configuredCode);
  const latestVersionCode =
    /^[1-9][0-9]*$/.test(configuredCode) && versionCode <= 2_100_000_000
      ? versionCode
      : null;

  return Response.json({ latestVersionCode }, {
    headers: { "Cache-Control": "no-store" },
  });
}
