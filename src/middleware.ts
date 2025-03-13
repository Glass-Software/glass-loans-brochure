import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Cache static assets aggressively
  if (
    request.nextUrl.pathname.match(
      /\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2)$/,
    )
  ) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
    return response;
  }

  // Cache API responses for 5 minutes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=300",
    );
    return response;
  }

  // Cache pages for 1 minute, but allow background revalidation
  response.headers.set(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=300",
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /api/contact (contact form endpoint)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/contact).*)",
  ],
};
