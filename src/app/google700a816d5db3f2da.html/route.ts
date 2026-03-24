/**
 * Google Search Console site verification.
 * Serves the verification file at /google700a816d5db3f2da.html
 */
export function GET() {
  return new Response(
    "google-site-verification: google700a816d5db3f2da.html",
    { headers: { "Content-Type": "text/html" } },
  );
}
