import { redirect } from 'next/navigation';
import ResetPasswordForm from './ResetPasswordForm';

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

function getToken(token: string | string[] | undefined) {
  if (Array.isArray(token)) {
    return token.find((value) => value.trim().length > 0) ?? null;
  }

  return token && token.trim().length > 0 ? token : null;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = getToken(params.token);

  if (!token) {
    redirect('/forgot-password?reason=missing-reset-token');
  }

  return <ResetPasswordForm token={token} />;
}
