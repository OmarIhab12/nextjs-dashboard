import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub)  session.user.id   = token.sub;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub  = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
  },
  providers: [],
} satisfies NextAuthConfig;