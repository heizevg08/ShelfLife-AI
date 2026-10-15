import { createSmtpMailTransport, type MailTransport } from './mail-transport';

export interface EmailChangeEmail { send(email: string, code: string): Promise<void> }

export function createEmailChangeEmail(env: NodeJS.ProcessEnv, transport: MailTransport | undefined = createSmtpMailTransport(env)): EmailChangeEmail | undefined {
  if (!transport) return;
  return { async send(email, code) {
    await transport.send({ to: email, subject: 'Verify your new ShelfLife AI email',
      text: `Your ShelfLife AI verification code is ${code}. It expires in 10 minutes. If you did not request this change, ignore this email.` });
  } };
}
