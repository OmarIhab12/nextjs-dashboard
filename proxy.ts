import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

const MANAGER_PATHS = [
  '/dashboard/orders',
  '/dashboard/suppliers',
  '/dashboard/wallet',
  '/dashboard/expenses',
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/login')) return;

  if (!req.auth) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = (req.auth.user as any)?.role as string | undefined;
  if (MANAGER_PATHS.some(p => pathname.startsWith(p)) && role !== 'admin' && role !== 'manager') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
