// Single source of truth for the user-facing Details sentence of an audit
// record (SoT §22). The Audit Logs table and the exported Audit Records
// workbook must describe the same event with the same words, so both surfaces
// call this module instead of composing their own wording.
//
// Presentation only: the stored record is never rewritten, and its raw
// `details` stay available for search and traceability. Sentences are
// assembled from whitelisted action/module/target fields; stored details are
// read only through recognized patterns, so internal technical wording never
// reaches a user-facing sentence for a known record. An unrecognized detail
// text is echoed only as a last-resort fallback — after status wording — and
// only when it carries nothing that would need redaction.

export interface AuditPresentation {
  action: string;
  module?: string;
  targetType: string;
  targetName?: string;
  status?: string;
  details?: string;
}

const sentence = (text: string) => /[.!?]$/.test(text) ? text : `${text}.`;

const actionLabel: Record<string, string> = {
  CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted',
  DEACTIVATE: 'Deactivated', REACTIVATE: 'Reactivated',
  EXPORT: 'Exported', LOGIN: 'Signed in', LOGOUT: 'Signed out',
};

const failureNoun: Record<string, string> = {
  CREATE: 'creation', UPDATE: 'update', DELETE: 'deletion',
  DEACTIVATE: 'deactivation', REACTIVATE: 'reactivation', EXPORT: 'export',
};

const successPhrases: Record<string, string> = {
  'User Management|CREATE': 'User account created',
  'User Management|UPDATE': 'User account updated',
  'User Management|DEACTIVATE': 'User account deactivated',
  'User Management|REACTIVATE': 'User account reactivated',
  'Ingredients|CREATE': 'Ingredient added to the inventory catalog',
  'Ingredients|UPDATE': 'Ingredient information updated',
  'Ingredients|DELETE': 'Ingredient removed from the inventory catalog',
  'Stock-In|CREATE': 'New ingredient stock received and recorded',
  'Usage Recording|CREATE': 'Ingredient usage recorded and available stock reduced',
  'Waste Recording|CREATE': 'Ingredient waste recorded and available stock reduced',
};

// Readable report subjects mirror the labels the Reports workspace shows
// (ManagerReportsPage reportOptions); unknown ids are humanized so a future
// report id still reads as text instead of a kebab-case code.
const reportSubjects: Record<string, string> = {
  'inventory-summary': 'Inventory Summary report',
  'usage-consumption': 'Usage & Consumption report',
  'expiration-waste': 'Expiration & Waste report',
  'inventory-period-report': 'Inventory Period report',
  'management-workbook': 'Management workbook',
};

const dayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Raw details are only echoed when they contain no credential, address or
// token shaped value, so a redaction-sensitive string can never surface in the
// table or workbook even if a future writer stores one.
const redactionSensitive = /@|\[?-?redacted-|eyJ[A-Za-z0-9_-]{10}/i;

function reportSubject(targetName?: string): string {
  const raw = targetName?.trim() ?? '';
  const known = reportSubjects[raw];
  if (known) return known;
  const humanized = raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!humanized) return 'requested report';
  return /\breport$/i.test(humanized) ? humanized : `${humanized} report`;
}

// Export audit details store `from..to; …`. Placeholders such as `snapshot`
// or `all-dates` mean no period was captured, and inventing one would
// misreport the record, so no period is appended in that case.
function exportPeriod(details: string): string {
  const match = /^([^.;]+)\.\.([^;]+);/.exec(details);
  if (!match) return '';
  const [, from, to] = match;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return '';
  const label = (value: string) => dayLabel.format(new Date(`${value}T00:00:00Z`));
  return from === to ? ` on ${label(from)}` : ` for ${label(from)} – ${label(to)}`;
}

function fallbackText(record: AuditPresentation, details: string, status: string): string {
  const entity = record.targetType.trim().toLowerCase() || 'target';
  // Status wording wins over any stored text: a failure or warning must never
  // inherit success-claiming detail wording written for a happy path.
  if (status === 'Failed') return `The ${failureNoun[record.action] ?? record.action.toLowerCase()} of the ${entity} record did not complete`;
  if (status === 'Warning') return `The ${failureNoun[record.action] ?? record.action.toLowerCase()} of the ${entity} record completed with a warning`;
  if (details && !redactionSensitive.test(details)) return details;
  return `${actionLabel[record.action] ?? record.action} ${entity} record`;
}

export function presentAuditDetails(record: AuditPresentation): string {
  const status = record.status ?? 'Success';
  const details = record.details?.trim() ?? '';
  const module = record.module?.trim() ?? '';

  if (record.action === 'LOGIN') {
    return sentence(status === 'Failed' ? 'Sign-in attempt failed' : 'Signed in');
  }
  if (record.action === 'LOGOUT') {
    return sentence(status === 'Failed' ? 'Sign-out did not complete' : 'Signed out');
  }

  if (record.targetType === 'Audit Records') {
    if (status === 'Failed') return 'Audit records export failed before a file was prepared.';
    if (status !== 'Success') return sentence(fallbackText(record, details, status));
    const count = /^XLSX export; (\d+) records$/.exec(details)?.[1];
    return sentence(count ? `Exported audit records to XLSX (${count} records)` : 'Exported audit records to XLSX');
  }

  if (record.action === 'EXPORT' && record.targetType === 'Report') {
    const subject = reportSubject(record.targetName);
    if (status === 'Failed') return sentence(`${subject} export failed`);
    if (status === 'Success') return sentence(`Exported ${subject}${exportPeriod(details)}`);
    return sentence(fallbackText(record, details, status));
  }

  if (status !== 'Success') return sentence(fallbackText(record, details, status));

  if (module === 'Account Profile' && record.action === 'UPDATE') {
    const fields = /^Self-service account update: (.+)$/.exec(details)?.[1];
    // Concise by design: the changed part is the whole message, so a self-service
    // first-name edit reads "Updated first name." instead of repeating the same
    // account framing on every row. The field list is still read from the stored
    // record, so the sentence stays evidence-accurate and nothing is re-derived.
    if (fields) return sentence(`Updated ${fields}`);
    if (/email address/i.test(details)) return 'Updated email address.';
    return 'Updated account information.';
  }

  if (module === 'Change Requests') {
    if (record.action === 'CREATE') {
      const type = /^(.+) submitted$/.exec(details)?.[1];
      return sentence(type ? `Submitted an ingredient change request: ${type}` : 'Submitted an ingredient change request');
    }
    if (record.action === 'UPDATE') {
      const approved = /^Approved and applied (.+)$/.exec(details)?.[1];
      if (approved) return sentence(`Change request approved and applied: ${approved}`);
      const rejected = /^Rejected (.+)$/.exec(details)?.[1];
      if (rejected) return sentence(`Change request rejected: ${rejected}`);
      // A decision written in a wording this formatter does not recognize is
      // still the actual decision; echo it unless it needs redaction.
      return sentence(details && !redactionSensitive.test(details) ? details : 'Change request updated');
    }
  }

  if (module === 'Ingredients' && record.action === 'UPDATE') {
    const applied = /^Applied approved (.+)$/.exec(details)?.[1];
    if (applied) return sentence(`Ingredient updated by an approved change request (${applied})`);
  }

  const phrase = successPhrases[`${module}|${record.action}`];
  return sentence(phrase ?? fallbackText(record, details, status));
}
