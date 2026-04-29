import type { NextAuthConfig } from 'next-auth';
 
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub; // ← exposes id on the session
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id; // ← stores id in the JWT
      }
      return token;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;