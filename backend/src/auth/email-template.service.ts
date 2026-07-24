import { Injectable } from '@nestjs/common';
import {
  ContactVerificationEmailInput,
  renderContactVerificationEmail,
} from './email-templates/contact-verification-email.template';
import {
  PendingOrganizationVerifiedEmailInput,
  renderPendingOrganizationVerifiedEmail,
} from './email-templates/pending-organization-verified-email.template';
import {
  ManagedPasswordResetEmailInput,
  PasswordResetEmailInput,
  renderManagedPasswordResetEmail,
  renderPasswordResetEmail,
} from './email-templates/password-reset-email.template';
import {
  getSafeAssetUrl,
  renderSecurityEmailLayout,
  renderVerificationCode,
} from './email-templates/security-email-layout.template';

/**
 * Injectable facade for pure email templates. Keeping this facade means business
 * services do not know template file locations and templates remain easy to test.
 */
@Injectable()
export class EmailTemplateService {
  buildPasswordResetEmail(input: PasswordResetEmailInput) {
    return renderPasswordResetEmail(input);
  }

  buildManagedPasswordResetEmail(input: ManagedPasswordResetEmailInput) {
    return renderManagedPasswordResetEmail(input);
  }

  buildContactEmailVerificationEmail(input: ContactVerificationEmailInput) {
    return renderContactVerificationEmail(input);
  }

  buildPendingOrganizationVerifiedEmail(
    input: PendingOrganizationVerifiedEmailInput,
  ) {
    return renderPendingOrganizationVerifiedEmail(input);
  }

  buildSecurityEmailHtml(
    input: Parameters<typeof renderSecurityEmailLayout>[0],
  ) {
    return renderSecurityEmailLayout(input);
  }

  renderVerificationCode(code: string) {
    return renderVerificationCode(code);
  }

  getSafeAssetUrl(value: string | null | undefined, appBaseUrl: string) {
    return getSafeAssetUrl(value, appBaseUrl);
  }
}
