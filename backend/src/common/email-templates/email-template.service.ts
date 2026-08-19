import { Injectable } from '@nestjs/common';
import {
  ContactVerificationEmailInput,
  renderContactVerificationEmail,
} from './contact-verification-email.template';
import {
  PendingOrganizationVerifiedEmailInput,
  renderPendingOrganizationVerifiedEmail,
} from './pending-organization-verified-email.template';
import {
  ManagedPasswordResetEmailInput,
  PasswordResetEmailInput,
  renderManagedPasswordResetEmail,
  renderPasswordResetEmail,
} from './password-reset-email.template';
import {
  getSafeAssetUrl,
} from './security-email-layout.template';
import {
  renderTwoFactorCodeEmail,
  type TwoFactorCodeEmailInput,
} from './two-factor-code-email.template';
import {
  renderContactEmailChangedEmail,
  type ContactEmailChangedInput,
} from './contact-email-changed.template';
import {
  renderLoginSecurityAlertEmail,
  type LoginSecurityAlertEmailInput,
} from './login-security-alert-email.template';
import {
  renderPublicContactReplyEmail,
  renderPublicContactSubmittedEmail,
  type PublicContactReplyEmailInput,
  type PublicContactSubmittedEmailInput,
} from './public-contact-email.template';
import {
  renderOnlineAdmissionStatusEmail,
  type OnlineAdmissionStatusEmailInput,
} from './online-admission-status-email.template';

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

  buildTwoFactorCodeEmail(input: TwoFactorCodeEmailInput) {
    return renderTwoFactorCodeEmail(input);
  }

  buildContactEmailChangedEmail(input: ContactEmailChangedInput) {
    return renderContactEmailChangedEmail(input);
  }

  buildLoginSecurityAlertEmail(input: LoginSecurityAlertEmailInput) {
    return renderLoginSecurityAlertEmail(input);
  }

  buildPublicContactSubmittedEmail(input: PublicContactSubmittedEmailInput) {
    return renderPublicContactSubmittedEmail(input);
  }

  buildPublicContactReplyEmail(input: PublicContactReplyEmailInput) {
    return renderPublicContactReplyEmail(input);
  }

  buildOnlineAdmissionStatusEmail(input: OnlineAdmissionStatusEmailInput) {
    return renderOnlineAdmissionStatusEmail(input);
  }

  getSafeAssetUrl(value: string | null | undefined, appBaseUrl: string) {
    return getSafeAssetUrl(value, appBaseUrl);
  }
}
