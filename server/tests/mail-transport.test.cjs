const test = require('node:test');
const assert = require('node:assert/strict');
const { createSmtpMailTransport } = require('../dist/services/mail-transport');
const { createEmailChangeEmail } = require('../dist/services/email-change-email');
const { createResetEmail } = require('../dist/services/reset-email');

test('SMTP transport requires a complete bounded configuration and never verifies by sending', () => {
  for (const env of [{}, { SMTP_HOST:'smtp.example.com' }, { SMTP_HOST:'smtp.example.com',SMTP_PORT:'0',SMTP_USER:'u',SMTP_PASS:'p' },
    { SMTP_HOST:'smtp.example.com',SMTP_PORT:'587',SMTP_USER:'u',SMTP_PASS:'' }]) assert.equal(createSmtpMailTransport(env), undefined);
});

test('SMTP transport uses TLS settings, an authorized sender, and a captured delivery adapter', async () => {
  let options, message;
  const transport = createSmtpMailTransport({ SMTP_HOST:'smtp.example.com', SMTP_PORT:'587', SMTP_USER:'mailer@shelflife.com',
    SMTP_PASS:'private-test-value', SMTP_FROM_NAME:'ShelfLife AI' }, value => { options=value; return { sendMail: async value => { message=value; } }; });
  assert(transport);
  assert.equal(options.secure, false); assert.equal(options.requireTLS, true);
  assert.deepEqual(options.auth, { user:'mailer@shelflife.com', pass:'private-test-value' });
  await transport.send({ to:'recipient@shelflife.com', subject:'Subject', text:'Body' });
  assert.deepEqual(message.from, { name:'ShelfLife AI', address:'mailer@shelflife.com' });
  assert.equal(message.to, 'recipient@shelflife.com');
});

test('email verification uses the shared captured transport and propagates delivery failure', async () => {
  let sent;
  const email = createEmailChangeEmail({}, { send: async message => { sent=message; } });
  await email.send('new@shelflife.com','123456');
  assert.equal(sent.to,'new@shelflife.com'); assert(sent.text.includes('123456'));
  await assert.rejects(createEmailChangeEmail({}, { send: async()=>{throw Error('offline')} }).send('new@shelflife.com','123456'));
});

test('password recovery and replacement-email verification share one configured SMTP transport', async () => {
  const messages = [];
  const env = { SMTP_HOST:'smtp.example.com', SMTP_PORT:'587', SMTP_USER:'mailer@shelflife.com', SMTP_PASS:'private-test-value',
    SMTP_FROM_NAME:'ShelfLife AI', PASSWORD_RESET_URL:'https://example.com/ShelfLifeAILogin' };
  const transport = createSmtpMailTransport(env, options => ({ sendMail: async message => { messages.push({ options, message }); } }));
  await createResetEmail(env, transport).send('account@shelflife.com', 'a'.repeat(64));
  await createEmailChangeEmail(env, transport).send('replacement@shelflife.com', '123456');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].options, messages[1].options);
  assert.deepEqual(messages.map(item => item.message.from), [
    { name:'ShelfLife AI', address:'mailer@shelflife.com' },
    { name:'ShelfLife AI', address:'mailer@shelflife.com' },
  ]);
  assert.match(messages[0].message.text, /#reset=/);
  assert.match(messages[1].message.text, /123456/);
});

test('HTTPS mail relay transport works over port 443 for Render Free Tier when SMTP_HOST is an https URL', async () => {
  const originalFetch = global.fetch;
  let capturedUrl, capturedInit;
  global.fetch = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response('OK', { status: 200 });
  };
  try {
    const transport = createSmtpMailTransport({
      SMTP_HOST: 'https://script.google.com/macros/s/example/exec',
      SMTP_PORT: '443',
      SMTP_USER: 'mailer@shelflife.com',
      SMTP_PASS: 'abcd efgh ijkl mnop',
      SMTP_FROM_NAME: 'ShelfLife AI',
    });
    assert(transport);
    await transport.send({ to: 'recipient@shelflife.com', subject: 'Welcome', text: 'Hello' });
    assert.equal(capturedUrl, 'https://script.google.com/macros/s/example/exec');
    assert.equal(capturedInit.method, 'POST');
    const payload = JSON.parse(capturedInit.body);
    assert.equal(payload.secret, 'abcdefghijklmnop');
    assert.equal(payload.to, 'recipient@shelflife.com');
    assert.equal(payload.fromName, 'ShelfLife AI');
  } finally {
    global.fetch = originalFetch;
  }
});
