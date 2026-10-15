import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dailyPeakInsight, biggestWasteCause, insightEmphasisSegments, topWasteIngredientInsight, wasteGuidance, wasteRecordCount, zeroWasteReasonInsight, zeroWasteReasonNames } from '../src/components/application/manager-usage-insights';
import type { WasteReason } from '../src/services/waste-records';

const reasons: WasteReason[] = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'];
const page = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('daily insights report actual usage and waste peaks, zero activity, and ties', () => {
  const points = [
    { date: '2026-10-12', usage: 1, waste: 0 },
    { date: '2026-10-13', usage: 2, waste: 2 },
    { date: '2026-10-14', usage: 0, waste: 1 },
  ];
  // A week names the weekday; a month names the date, since a weekday repeats within it.
  assert.equal(dailyPeakInsight(points, 'usage', 'Weekly'), 'Usage peaked on Tuesday (2 records).');
  assert.equal(dailyPeakInsight(points, 'waste', 'Monthly'), 'Waste peaked on Oct 13 (2 records).');
  assert.equal(dailyPeakInsight([{ date: '2026-10-13', usage: 1, waste: 2 }, { date: '2026-10-14', usage: 0, waste: 2 }], 'waste', 'Weekly'), 'Waste peaked on multiple days (2 records each).');
  assert.equal(dailyPeakInsight([{ date: '2026-10-13', usage: 1, waste: 0 }], 'waste', 'Today'), 'No waste records in this period.');
  assert.equal(dailyPeakInsight([{ date: '2026-10-13', usage: 0, waste: 1 }], 'usage', 'Today'), 'No usage records in this period.');
  assert.equal(dailyPeakInsight([{ date: '2026-10-13', usage: 1, waste: 0 }], 'usage', 'Today'), 'Usage today: 1 record.');
});

test('zero-reason insight handles one, several, all, and no zero categories', () => {
  const counts = { Expired: 1, Spoiled: 2, Damaged: 1, 'Over-prepared': 0, Other: 0 };
  assert.equal(zeroWasteReasonInsight(counts, reasons), 'No waste records for Over-prepared and Other in this period.');
  assert.equal(zeroWasteReasonInsight({ ...counts, Other: 1 }, reasons), 'No waste records for Over-prepared in this period.');
  assert.equal(zeroWasteReasonInsight({ ...counts, Other: 1, 'Over-prepared': 1 }, reasons), 'Every supported waste reason has at least one record in this period.');
  assert.match(zeroWasteReasonInsight({ Expired: 0, Spoiled: 0, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons), /Expired.*Spoiled.*Damaged.*Over-prepared.*Other/);
});

test('top waste item comes from record-count ranking and preserves ties and empty states', () => {
  assert.equal(topWasteIngredientInsight([]), 'No top waste item in this period.');
  assert.equal(topWasteIngredientInsight([{ ingredientId: 'a', name: 'Chicken', count: 2 }]), 'Top waste item: Chicken (2 records).');
  assert.equal(topWasteIngredientInsight([{ ingredientId: 'a', name: 'Chicken', count: 2 }, { ingredientId: 'b', name: 'Beef', count: 2 }]), 'Top waste items: Chicken and Beef (2 records each).');
  assert.equal(topWasteIngredientInsight(Array.from({ length: 5 }, (_, index) => ({ ingredientId: String(index), name: `Item ${index}`, count: 2 }))), 'Multiple ingredients share the highest waste record count (2 records each).');
  assert.equal(topWasteIngredientInsight([{ ingredientId: 'a', name: 'Unavailable ingredient (123456)', count: 1 }]), 'Top waste ingredient name unavailable (1 record).');
  assert.equal(topWasteIngredientInsight([{ ingredientId: 'a', name: 'Unavailable ingredient (123456)', count: 2 }, { ingredientId: 'b', name: 'Known', count: 2 }]), 'Multiple ingredients share the highest waste record count (2 records each); some names are unavailable.');
});

test('Manager callouts follow each card analytics response on its own period', () => {
  // Superseded: the `Used:`/`Wasted:` pills. The trend card renders the restored paired
  // peak callouts, generated from the chart's own daily points on that card's own period.
  assert.match(page, /dailyPeakInsight\(dailyPoints, 'usage', usagePeriod\)/);
  assert.match(page, /dailyPeakInsight\(dailyPoints, 'waste', usagePeriod\)/);
  assert.match(page, /wasteGuidance\(reasonAnalytics\.byReason, WASTE_REASONS\)/);
  // The zero-count reasons are chips now, so the sentence helper is replaced by the name
  // list the chips are built from. Both read the same record counts.
  assert.match(page, /zeroWasteReasonNames\(reasonAnalytics\.byReason, WASTE_REASONS\)/);
  // The card explains the distribution of waste by reason. A ranking of top
  // ingredients answers a different question and crowded the card, so the reason
  // card no longer renders it. The helper and its API field stay for traceability.
  assert.doesNotMatch(page, /topWasteIngredientInsight\(/);
  assert.doesNotMatch(page, /<p className="sl-manager-insight" data-tone="warm">/);
  assert.match(page, /reasonAnalytics\.total === 0 && <div className="sl-manager-reason-empty">/);
  assert.match(page, /reasonAgree && reasonAnalytics && wasteGuidance\(reasonAnalytics\.byReason, WASTE_REASONS\) && <div className="sl-manager-reason-insights"/);
  assert.match(page, /\[usagePeriod, category, ingredientFilter, analyticsRevision\]/);
  assert.match(page, /\[wastePeriod, category, ingredientFilter, analyticsRevision\]/);
  assert.match(page, /FilterSelect ariaLabel="Filter usage and waste by date range" value=\{range\}/);
  assert.match(page, /getUsageAnalytics\(query, signal\)/);
  assert.match(page, /getWasteAnalytics\(query, signal\)/);
  assert.doesNotMatch(page, /Top Ingredients by Waste/);
  assert.doesNotMatch(page, /Waste record counts by reason ·|Daily records ·/);
  assert.doesNotMatch(page, /Usage is steady across the week|Waste peaked on Saturday|Chicken Breast & Chimiken/);
});

test('callouts retain paired desktop, stacked mobile, and compact reason composition', () => {
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-insight-pair \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-reason-insights \{[^}]*display: grid; gap: var\(--sl-space-3\)/);
  assert.match(css, /@media \(width<=420px\) \{\s*\.sl-manager-usage-live \.sl-manager-insight-pair \{ grid-template-columns: minmax\(0,1fr\); \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-application-bar-breakdown \{ flex: 0 0 auto;/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-insight \{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/);
});

test('all Manager insights use the chart inset and the established compact radius token', () => {
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-insight-pair \{[^}]*box-sizing: border-box;[^}]*width: 100%; margin: 0; padding-inline: var\(--sl-space-4\); \}/);
  // Superseded: alignment is no longer forced. The insight follows the bars in natural
  // flow, so margin-top: auto must be gone: stretching the card to match its neighbour
  // is exactly what pushed the insight to the foot.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-reason-insights \{[^}]*box-sizing: border-box;[^}]*width: 100%; margin-top: 0; margin-bottom: 0; \}/);
  // P5: the guidance wrapper adds no inset of its own any more. The card body now owns
  // the one inline inset, so the pill's own padding is what sets its text edge and the
  // guidance lines up with every other section instead of sitting 20px further in.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-reason-insights \{ padding-inline: 0; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-reason-insights \.sl-manager-insight \{ padding-inline: .9rem; \}/);
  assert.doesNotMatch(css, /\.sl-manager-reason-insights \{[^}]*margin-top: auto/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-insight \{[^}]*border-radius: var\(--sl-radius-lg\); padding: var\(--sl-space-3\) var\(--sl-space-5\);/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-application-bar-breakdown \{ margin-top: 0; \}/);
  assert.match(css, /:is\(\s?\.sl-manager-usage-live,\s*\.sl-mgr-forecast-page,\s*\.sl-mgr-fc-preview,\s*\.sl-manager-alerts-live\s?\) \.sl-manager-daily-chart \{[^}]*padding: .75rem 1.25rem 0;/);
  assert.match(css, /@media \(width<=420px\) \{\s*\.sl-manager-usage-live \.sl-manager-insight-pair \{ grid-template-columns: minmax\(0,1fr\); \}/);
});

test('inline emphasis changes only semantic anchors and preserves the exact spoken text', () => {
  const cases = [
    ['Usage peaked on Tuesday (2 records).', ['Usage'], ['Usage']],
    ['Waste peaked on multiple days (2 records each).', ['Waste'], ['Waste']],
    ['No waste records for Over-prepared and Other in this period.', reasons, ['Over-prepared', 'Other']],
    ['Top waste item: Chicken (2 records).', ['Top waste items:', 'Top waste item:'], ['Top waste item:']],
    ['Top waste items: Chicken and Beef (2 records each).', ['Top waste items:', 'Top waste item:'], ['Top waste items:']],
  ] as const;
  for (const [sentence, anchors, expected] of cases) {
    const segments = insightEmphasisSegments(sentence, anchors);
    assert.equal(segments.map(part => part.text).join(''), sentence);
    assert.deepEqual(segments.filter(part => part.emphasized).map(part => part.text), expected);
  }
  assert.match(page, /<strong className="sl-emphasized-value" key=\{index\}>\{part\.text\}<\/strong>/);
  assert.match(css, /\.sl-emphasized-value \{ font-weight: 600!important; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-insight \.sl-emphasized-value \{ font-weight: 700!important; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-insight \{[^}]*font-weight: 500;/);
});

test('the two summary tiles count waste records, never quantities or units', () => {
  const counts = { Expired: 2, Spoiled: 1, Damaged: 0, 'Over-prepared': 0, Other: 1 };
  // Four records across three reasons, not 4 kg plus 2 L: a summed quantity would mix
  // units the data does not share. The tiles and the bars read the same number.
  assert.equal(wasteRecordCount(counts, reasons), 4);
  assert.deepEqual(zeroWasteReasonNames(counts, reasons), ['Damaged', 'Over-prepared']);
  assert.deepEqual(zeroWasteReasonNames({ Expired: 0, Spoiled: 0, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons), reasons);
});

test('the biggest cause names every leading reason, and ties are never reduced to a count', () => {
  assert.deepEqual(biggestWasteCause({ Expired: 3, Spoiled: 1, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons),
    { value: 'Expired', note: '3 records · 75% of waste records' });
  // Two reasons with the same count give no single winner. Naming BOTH still picks no
  // winner: it reports the full set of leaders, which is what the Manager acts on. The
  // names come out in the canonical WASTE_REASONS order, so the tile never reorders
  // itself between two loads of the same data.
  const tied = biggestWasteCause({ Expired: 2, Spoiled: 2, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons);
  assert.equal(tied.value, 'Expired, Spoiled');
  assert.match(tied.note, /^2 records each · 100% of waste records$/);
  // A three-way tie lists all three, and a reason below the peak is never included.
  assert.equal(biggestWasteCause({ Expired: 3, Spoiled: 3, Damaged: 3, 'Over-prepared': 1, Other: 0 }, reasons).value, 'Expired, Spoiled, Damaged');
  assert.equal(biggestWasteCause({ Expired: 1, Spoiled: 1, Damaged: 1, 'Over-prepared': 0, Other: 0 }, reasons).value, 'Expired, Spoiled, Damaged');
  // Order follows the canonical list, never the size of the counts.
  assert.equal(biggestWasteCause({ Expired: 1, Spoiled: 0, Damaged: 4, 'Over-prepared': 0, Other: 4 }, reasons).value, 'Damaged, Other');
  // A period with no waste has no cause to report, so it says unavailable, not zero winner.
  assert.deepEqual(biggestWasteCause({ Expired: 0, Spoiled: 0, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons),
    { value: '—', note: 'No waste records in this period' });
});

test('a list of tied reasons wraps at word boundaries instead of breaking mid-word', () => {
  // Naming two or three leaders makes the tile's value a list, not one short word. The
  // value must never be split inside a name: the earlier `overflow-wrap: anywhere` broke
  // "Expired" into "Expire d" at mobile width, which reads as clipped text. The names are
  // never truncated either - the list wraps onto further lines and the tile grows with it.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-reason-tile>strong \{[^}]*overflow-wrap: break-word;/);
  assert.match(css, /@media \(width<=420px\) \{ \.sl-manager-usage-live \.sl-manager-reason-tile>strong \{ font-size: 1\.05rem; \} \}/);
  assert.doesNotMatch(css, /\.sl-manager-reason-tile>strong \{[^}]*overflow-wrap: anywhere/);
});

test('guidance appears only when the data supports it and never claims a model produced it', () => {
  assert.match(wasteGuidance({ Expired: 3, Spoiled: 0, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons)!, /^Most waste is Expired\./);
  assert.match(wasteGuidance({ Expired: 0, Spoiled: 0, Damaged: 0, 'Over-prepared': 2, Other: 0 }, reasons)!, /^Most waste is Over-prepared\./);
  // An even split gives no dominant cause, so nothing specific can be advised.
  assert.equal(wasteGuidance({ Expired: 1, Spoiled: 1, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons), null);
  // 'Other' has no single known remedy, so no guidance is invented for it.
  assert.equal(wasteGuidance({ Expired: 0, Spoiled: 0, Damaged: 0, 'Over-prepared': 0, Other: 2 }, reasons), null);
  assert.equal(wasteGuidance({ Expired: 0, Spoiled: 0, Damaged: 0, 'Over-prepared': 0, Other: 0 }, reasons), null);
  // Every guidance sentence is plain operational advice: no model, prediction or forecast claim.
  const page = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
  assert.match(page, /wasteGuidance\(reasonAnalytics\.byReason, WASTE_REASONS\)/);
  assert.doesNotMatch(page, /AI recommends|our model|predicted waste|forecast suggests/i);
});

test('the reason card shows bars only for reasons with records and chips for the rest', () => {
  const page = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
  // A full-width bar for a zero count has no length to read, so zero reasons move to chips.
  assert.match(page, /WASTE_REASONS\.filter\(reason => \(reasonAnalytics\.byReason\[reason\] \?\? 0\) > 0\)/);
  assert.match(page, /<span>No waste from:<\/span>/);
  assert.match(page, /zeroWasteReasonNames\(reasonAnalytics\.byReason, WASTE_REASONS\)\.map\(reason => <li key=\{reason\}>\{reason\}<\/li>\)/);
  assert.match(page, /<span>Waste Records<\/span>/);
  assert.match(page, /<span>Biggest Cause<\/span>/);
});

test('an empty period keeps the reason card hierarchy instead of replacing it', () => {
  // The generic state must not be the empty branch: replacing the body would blank the
  // tiles, the zero-reason chips and the card's own structure.
  assert.equal(/reasonAnalytics\.total === 0 && <DataState/.test(page), false);
  assert.match(page, /reasonAnalytics\.total === 0 && <div className="sl-manager-reason-empty">/);
  assert.match(page, /No waste records in this period\./);
  // Every supported reason lists as a chip in an empty period, so a clean week reads as
  // a clean week rather than as a card that failed to load.
  assert.match(page, /\{zeroWasteReasonNames\(reasonAnalytics\.byReason, WASTE_REASONS\)\.length > 0 &&/);
  // The compact explainer remains in normal flow. Empty and populated KPI rows now
  // share the same top alignment; the browser geometry test checks their actual gaps.
  assert.match(css, /\.sl-manager-reason-empty \{ display: grid;/);
  assert.equal(/\.sl-manager-reason-empty\s*\{[^}]*flex:\s*1/.test(css), false);
  assert.equal(/\.sl-card-body:has\(>\.sl-manager-reason-empty\)\s*\{\s*justify-content:\s*center/.test(css), false);
});

test('the LOCKED Waste by Reason baseline keeps the approved copy and period wiring', () => {
  // APPROVED / LOCKED 2026-10-13. This guard exists so a later pass cannot quietly change
  // the approved Manager analytics baseline: if any of these move, the lock must be
  // re-opened and re-approved deliberately rather than drifting a line at a time.
  //
  // LOCKED copy: the tie names its reasons instead of counting them, and a zero period
  // still reports no cause rather than a winner.
  assert.match(page, /biggestWasteCause\(reasonAnalytics\.byReason, WASTE_REASONS\)\.value/);
  assert.doesNotMatch(page, /reasons tied/);
  assert.doesNotMatch(page, /Top waste item/i);
  // LOCKED: the three date selections stay independent. Each card keeps its own period
  // state, and the records-toolbar range never feeds a card's analytics query.
  assert.match(page, /analyticsQueryPeriod\(/);
  assert.doesNotMatch(page, /recordsRangeWindow\(/);
  // LOCKED: the reason card's own period control is present and drives only this card.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-analytics-period \{[^}]*flex: 0 0 auto;/);
  // LOCKED spacing contract from the approved geometry: 12px header-to-KPI,
  // 32px KPI-to-content and 32px content-to-chips, with bars 26px on a 62px pitch.
  assert.match(css, /\.sl-manager-usage-analytics>\.sl-card:nth-child\(2\)>\.sl-card-body \{ align-items: stretch; gap: 2rem;/);
  assert.match(css, /\.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-application-bar-list \{ flex: 0 0 auto; gap: 2\.25rem; \}/);
  assert.match(css, /\.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-application-bar-track \{ height: 1\.625rem; \}/);
  assert.match(css, /\.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-card-header \{ align-items: center;/);
});
