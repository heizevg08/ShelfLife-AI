import { Link } from '@tanstack/react-router';
import { ArrowUp, FileText, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/application/Brand';
import { ACCOUNT_TERMS } from '../content/account-terms';
import '../styles/terms.css';

const termsHeadings = [
  'About These Terms', 'Who Operates the System', 'Eligibility', 'Account Creation and Approval',
  'User Roles and Permissions', 'Your Account Security', 'Acceptable Use', 'Inventory Data and Your Content',
  'AI-Generated Forecasts and Recommendations', 'Alerts and Notifications', 'Audit Logging and Monitoring',
  'Change Requests and Approvals', 'Availability and Changes to the System', 'Intellectual Property',
  'Suspension and Termination', 'Disclaimers', 'Limitation of Liability', 'Changes to These Terms',
  'Governing Law and Disputes', 'Contact',
];
const privacyHeadings = [
  'Introduction', 'Who Is Responsible for Your Data', 'Information We Collect', 'How We Collect Information',
  'Why We Use Your Information', 'Basis for Processing', 'How Forecasting Uses Data',
  'Who Can Access or Receive Information', 'Where Information Is Stored', 'How Long Information Is Kept',
  'How We Protect Information', 'Your Privacy Rights', 'Cookies and Local Storage',
  'Children’s Data', 'External Services', 'Changes to This Privacy Policy', 'Contact and Complaints',
];

type PolicySection = { id: string; title: string; text: string };

function readSections(part: string, titles: string[], from: number, to = ACCOUNT_TERMS.length): PolicySection[] {
  const matches = titles.map((title, index) => {
    const marker = `${index + 1}. ${title}`;
    const start = ACCOUNT_TERMS.indexOf(marker, from);
    return { id: `${part}-${index + 1}`, title, start, end: start + marker.length };
  });
  return matches.filter(section => section.start >= 0).map((section, index, found) => {
    const nextStart = found[index + 1]?.start ?? to;
    return { id: section.id, title: section.title, text: ACCOUNT_TERMS.slice(section.end, nextStart).trim() };
  });
}

function PolicyText({ text }: { text: string }) {
  const withEmailLink = (value: string) => value.split(/(shelflifemanagement@gmail\.com)/gi).map((part, index) =>
    part.toLowerCase() === 'shelflifemanagement@gmail.com'
      ? <a key={index} href="mailto:shelflifemanagement@gmail.com" aria-label="Email ShelfLife AI at shelflifemanagement@gmail.com">{part}</a>
      : part);
  const bulletAt = text.indexOf('•');
  if (bulletAt >= 0) {
    const intro = text.slice(0, bulletAt).trim();
    const items = text.slice(bulletAt).split('•').map(item => item.trim()).filter(Boolean);
    return <>{intro && <p>{withEmailLink(intro)}</p>}<ul className="sl-terms-list">{items.map((item, index) => <li key={index}>{withEmailLink(item)}</li>)}</ul></>;
  }
  const clauses = text.split(/\s(?=(?:[2-9]|1\d)\.\s(?:[A-Z“‘]))/);
  if (clauses.length > 1 && /^1\.\s\S/.test(clauses[0])) {
    return <ol className="sl-terms-list">{clauses.map((clause, index) => <li key={index}>{withEmailLink(clause.replace(/^\d+\.\s*/, ''))}</li>)}</ol>;
  }
  return <p>{withEmailLink(text)}</p>;
}

function SectionCard({ section }: { section: PolicySection }) {
  return <section className="sl-terms-section" id={section.id}>
    <span className="sl-terms-section-number">{section.id.split('-')[1].padStart(2, '0')}</span>
    <div><h3>{section.title}</h3><PolicyText text={section.text} /></div>
  </section>;
}

export default function Terms() {
  const partOneAt = ACCOUNT_TERMS.indexOf('Part 1: Terms and Conditions');
  const partTwoAt = ACCOUNT_TERMS.indexOf('Part 2: Privacy Policy');
  const acceptanceAt = ACCOUNT_TERMS.indexOf('Acceptance By selecting');
  const intro = ACCOUNT_TERMS.slice(0, partOneAt).replace(/^ShelfLife AI: Terms and Conditions and Privacy Policy\s*/, '').trim();
  const terms = readSections('terms', termsHeadings, partOneAt, partTwoAt);
  const privacy = readSections('privacy', privacyHeadings, partTwoAt, acceptanceAt);
  const acceptance = acceptanceAt >= 0 ? ACCOUNT_TERMS.slice(acceptanceAt + 'Acceptance '.length).trim() : '';
  const contents = [
    { label: 'Terms and Conditions', items: terms },
    { label: 'Privacy Policy', items: privacy },
    { label: 'Acceptance', items: [{ id: 'acceptance', title: 'Acceptance' }] },
  ];

  return <main className="sl-terms-page" id="top">
    <header className="sl-terms-topbar"><Link to="/ShelfLifeAILogin" className="sl-terms-back" aria-label="ShelfLife AI — go to sign in"><Brand /></Link><span className="sl-terms-topbar-label">POLICIES &amp; ACCOUNT INFORMATION</span></header>
    <div className="sl-terms-layout">
      <aside className="sl-terms-sidebar">
        <div className="sl-terms-sidebar-title"><FileText size={17} /> On this page</div>
        {contents.map(group => <div className="sl-terms-nav-group" key={group.label}>
          <div className="sl-terms-nav-heading">{group.label}</div>
          {group.items.map(item => <a href={`#${item.id}`} key={item.id}>{item.title}</a>)}
        </div>)}
      </aside>

      <article className="sl-terms-content">
        <div className="sl-terms-eyebrow"><ShieldCheck size={15} /> SHELFLIFE AI POLICIES</div>
        <h1>Terms of Service <span>&amp;</span><br />Privacy Policy</h1>
        <p className="sl-terms-lead">Please review the terms that apply to your ShelfLife AI account and how account and establishment data is handled.</p>
        <div className="sl-terms-meta"><span>Version 1.0</span><span>Effective: [DATE]</span><span>Last updated: [DATE]</span></div>
        <div className="sl-terms-draft"><strong>Draft document</strong><span>Complete all [BRACKETED] fields and review this policy before publishing.</span></div>
        <details className="sl-terms-document-note"><summary>Document scope and notice</summary><p>{intro}</p></details>

        <TermsPolicyContent />
        <footer className="sl-terms-footer"><span>Questions about these policies? Contact your system administrator.</span><a href="#top" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top <ArrowUp size={14} /></a></footer>
      </article>
    </div>
  </main>;
}

export function TermsPolicyContent() {
  const partOneAt = ACCOUNT_TERMS.indexOf('Part 1: Terms and Conditions');
  const partTwoAt = ACCOUNT_TERMS.indexOf('Part 2: Privacy Policy');
  const acceptanceAt = ACCOUNT_TERMS.indexOf('Acceptance By selecting');
  const terms = readSections('terms', termsHeadings, partOneAt, partTwoAt);
  const privacy = readSections('privacy', privacyHeadings, partTwoAt, acceptanceAt);
  const acceptance = acceptanceAt >= 0 ? ACCOUNT_TERMS.slice(acceptanceAt + 'Acceptance '.length).trim() : '';
  return <>
    <div className="sl-terms-part-heading" id="terms"><span>PART 01</span><h2>Terms and Conditions</h2><p>Rules for account access and use of the system.</p></div>
    <div className="sl-terms-sections">{terms.map(section => <SectionCard section={section} key={section.id} />)}</div>
    <div className="sl-terms-part-heading" id="privacy"><span>PART 02</span><h2>Privacy Policy</h2><p>How personal information and establishment data are handled.</p></div>
    <div className="sl-terms-sections">{privacy.map(section => <SectionCard section={section} key={section.id} />)}</div>
    <section className="sl-terms-acceptance" id="acceptance"><div className="sl-terms-eyebrow">YOUR ACKNOWLEDGMENT</div><h2>Acceptance</h2><p>{acceptance}</p></section>
  </>;
}
