import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRequestLogContext, logServerError } from "@/lib/observability";
import { MAINTENANCE_MODE_ACTIVE } from "@/lib/maintenance";

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
}

function redirectTo(request: NextRequest, sessionResponse: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return copyCookies(sessionResponse, NextResponse.redirect(url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (MAINTENANCE_MODE_ACTIVE || pathname === "/mantenimiento") {
    if (MAINTENANCE_MODE_ACTIVE && pathname === "/mantenimiento") {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = MAINTENANCE_MODE_ACTIVE ? "/mantenimiento" : "/";
    url.search = "";
    const redirect = NextResponse.redirect(url, 307);
    redirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return redirect;
  }

  // API routes previously bypassed the proxy. Preserve that flow when unpaused.
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const startedAt = performance.now();
  const logContext = getRequestLogContext(request);
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isLogin = path === "/login";
    const isProtected =
      path.startsWith("/admin") ||
      path.startsWith("/picking") ||
      path.startsWith("/cuenta") ||
      path.startsWith("/tablero");

    if (!user && isProtected) {
      return redirectTo(request, response, "/login", `?next=${encodeURIComponent(path)}`);
    }

    if (user && isLogin) {
      return redirectTo(request, response, "/");
    }

    return response;
  } catch (error) {
    logServerError("proxy.auth_failed", error, {
      ...logContext,
      operation: "proxy.auth",
      durationMs: performance.now() - startedAt,
    });
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|icons(?:/|$)|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
