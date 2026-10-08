import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseConfig, supabasePublishableKey, supabaseUrl } from '@/lib/supabase/env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/cliente' ||
    pathname === '/auth/callback' ||
    pathname === '/auth/signout' ||
    pathname === '/auth/update-password' ||
    /^\/portal\/orcamento\/[^/]+\/?$/.test(pathname) ||
    /^\/api\/portal\/quotes\/[^/]+\/approve$/.test(pathname) ||
    /^\/acompanhar\/[^/]+\/?$/.test(pathname) ||
    /^\/api\/portal\/orders\/[^/]+\/approve$/.test(pathname) ||
    /^\/api\/portal\/orders\/[^/]+\/pickup-authorization$/.test(pathname) ||
    /^\/cadastro\/[^/]+\/?$/.test(pathname) ||
    /^\/api\/clients\/profile-link\/[^/]+\/?$/.test(pathname);

  if (!hasSupabaseConfig()) {
    if (isPublicRoute || process.env.NODE_ENV !== 'production') return response;
    if (isApiRoute) {
      return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });
    }
    return new NextResponse('Authentication service is not configured.', { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && !isPublicRoute) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return response;
}
