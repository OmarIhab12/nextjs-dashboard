import VinslonLogo from '@/app/ui/vinslon-logo';
import LoginForm from '@/app/ui/login-form';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6 p-4">
        <div className="w-48 self-center rounded-xl bg-white p-4">
          <VinslonLogo />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
