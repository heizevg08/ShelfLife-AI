const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { createSmtpMailTransport } = require('../dist/services/mail-transport');
const { createResetEmail } = require('../dist/services/reset-email');
const { createEmailChangeEmail } = require('../dist/services/email-change-email');
const { readConfig } = require('../dist/config/env');

const root = resolve(__dirname, '..', '..');
const provider = 'res' + 'end';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|cjs|json)$/.test(entry.name) ? [path] : [];
  });
}

const smtp = { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'mailer@shelflife.com', SMTP_PASS: 'private-test-value', PASSWORD_RESET_URL: 'https://shelflife-ai-one.vercel.app/ShelfLifeAILogin' };

test('no package manifest, lockfile, or server source references the retired email provider', () => {
  const files = [join(root, 'package.json'), join(root, 'client', 'package.json'), join(root, 'server', 'package.json'), ...sourceFiles(join(root, 'server', 'src'))];
  if (existsSync(join(root, 'package-lock.json'))) files.push(join(root, 'package-lock.json'));
  for (const file of files) assert.equal(readFileSync(file, 'utf8').toLowerCase().includes(provider), false, `${file} must not reference the retired provider`);
});

test('the environment template documents SMTP delivery and no retired-provider variables', () => {
  const template = readFileSync(join(root, 'server', '.env.example'), 'utf8');
  for (const name of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'SMTP_FROM_NAME', 'PASSWORD_RESET_URL']) assert.match(template, new RegExp(`^${name}=`, 'm'));
  assert.equal(template.toLowerCase().includes(provider), false);
});

test('leftover provider variables never enable delivery or satisfy the SMTP requirement', () => {
  const stale = { [`${provider}_api_key`.toUpperCase()]: 'unused-test-value', [`${provider}_from`.toUpperCase()]: 'unused@example.com' };
  assert.equal(createSmtpMailTransport({ ...stale }), undefined);
  assert.equal(createResetEmail({ ...stale, PASSWORD_RESET_URL: smtp.PASSWORD_RESET_URL }), undefined);
  assert.equal(createEmailChangeEmail({ ...stale }), undefined);
  assert.ok(createSmtpMailTransport({ ...smtp, ...stale }, () => ({ sendMail: async () => {} })));
});

test('SMTP is optional for startup configuration and has no provider-specific requirement', () => {
  const config = readConfig({ MONGO_URI: 'mongodb://test.invalid/foundation', NODE_ENV: 'test' });
  assert.equal(config.mongoUri, 'mongodb://test.invalid/foundation');
  assert.equal(Object.keys(config).some(key => key.toLowerCase().includes(provider)), false);
});

test('a failing SMTP delivery propagates to the caller and the SMTP password never enters a message', async () => {
  const transport = createSmtpMailTransport(smtp, () => ({ sendMail: async () => { throw new Error('535 authentication failed'); } }));
  await assert.rejects(createResetEmail(smtp, transport).send('account@shelflife.com', 'a'.repeat(64)), /535/);
  const sent = [];
  const working = createSmtpMailTransport(smtp, () => ({ sendMail: async message => { sent.push(message); } }));
  await createResetEmail(smtp, working).send('account@shelflife.com', 'a'.repeat(64));
  await createEmailChangeEmail(smtp, working).send('new@shelflife.com', '123456');
  assert.ok(sent.some(message => message.text.includes(`${smtp.PASSWORD_RESET_URL}#reset=`)));
  assert.equal(JSON.stringify(sent).includes(smtp.SMTP_PASS), false);
});
