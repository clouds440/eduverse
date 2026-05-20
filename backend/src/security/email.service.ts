import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(options: SendEmailOptions) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from =
      this.config.get<string>('RESEND_FROM_EMAIL') ||
      this.config.get<string>('MAIL_FROM') ||
      'EduVerse <onboarding@resend.dev>';

    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY is not configured. Email "${options.subject}" to ${options.to} was not sent.`,
      );
      this.logger.debug(options.text);
      return { skipped: true };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `Resend email failed (${response.status}) for ${options.to}: ${body}`,
      );
      throw new Error('Email delivery failed');
    }

    return response.json().catch(() => ({}));
  }
}
