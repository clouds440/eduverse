import ForgotPasswordForm from './ForgotPasswordForm';

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    reason?: string | string[];
  }>;
};

const reasonMessages: Record<string, string> = {
  'missing-reset-token': 'Your reset link is missing or invalid. Please request a new password reset link.',
};

function getReasonMessage(reason: string | string[] | undefined) {
  const value = Array.isArray(reason) ? reason[0] : reason;

  return value ? reasonMessages[value] ?? '' : '';
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;

  return <ForgotPasswordForm initialReasonMessage={getReasonMessage(params.reason)} />;
}
