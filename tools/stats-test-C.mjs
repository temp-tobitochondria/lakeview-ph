#!/usr/bin/env node
// Test Case C runner (Lake Bunot vs threshold; vs Sampaloc; DO threshold; pH range)

import {
  shapiroWilkAsync,
  tOneSampleAsync,
  wilcoxonSignedRankAsync,
  signTestAsync,
  tostEquivalenceAsync,
  tostEquivalenceWilcoxonAsync,
  tTwoSampleStudentAsync,
  tTwoSampleWelchAsync,
  mannWhitneyAsync,
  moodMedianAsync,
  leveneTwoSampleAsync
} from '../resources/js/stats/statsUtils.js';

import { buildSeasonSeriesFromMonthly, seasonalMK, sensSlopeCombined } from '../resources/js/stats/seasonalMK.js';

import { bulletLine, section, print } from './_stats-test-common.mjs';

const alpha = 0.05;

// ---------------------- Mock Data (C) ----------------------
// One-sample threshold (DO vs 5)
const LakeA_single = [
  7.1, 5.5, 7.9, 7.6, 6.1, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3
];
const mu0 = 5;

// Range threshold (pH 6.5 - 8.5)
const LakeA_range = [
  7.3, 7.3, 7.8, 7.4, 7.4, 7.3, 7.6, 7, 6.8, 7.3, 7, 6.9, 7.5, 7.4, 7.3, 6.9, 7.3, 8, 7, 6.8, 7.1, 6.9, 7, 6.5, 6.8, 6.7, 7.8, 6.9, 6.8, 6.8, 6.4, 6.6, 6.6, 6.6, 6.8, 7, 6.7, 6.9, 6.7, 6.6, 6.8, 6.8, 7, 7.2, 7, 6.9, 6.8, 6.7, 7.2, 7.3, 7.2, 6.8, 7.3, 6.8, 6.8, 6.7, 6.5, 7, 6.9, 6.8, 6.6, 6.6, 6.6, 6.7, 6.6, 6.5, 7, 6.5, 6.5, 6.9, 6.7, 7.2, 6.8, 6.7
];
const lower = 6.5, upper = 8.5;

// Lake vs Lake arrays (Lake Bunot vs Sampaloc Lake)
const LakeA = [
  7.1, 5.5, 7.9, 7.6, 6.1, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3
];
const LakeB = [
  7.1, 5.5, 7.9, 7.6, 6.1, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 7.6, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 7.6, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 6.7, 7.6, 6.2, 6.1, 5.8, 6.4, 6.3, 7.1, 5.5, 7.9, 7.6, 6.1, 5.8, 6.4, 6.3
];

// Seasonal MK monthly points (select DO values per date from provided CSV blocks)
const monthlyPointsC = [
  ['1996-01-31 10:00:00', 7.1], ['1996-02-12 10:00:00', 5.5], ['1996-03-20 10:00:00', 7.9], ['1996-06-19 10:00:00', 7.6], ['1996-09-04 10:00:00', 6.1], ['1996-11-05 10:00:00', 6.4], ['1996-12-16 10:00:00', 6.3],
  ['1997-01-27 10:00:00', 7.1], ['1997-02-03 10:00:00', 5.5], ['1997-03-06 10:00:00', 7.9], ['1997-05-27 10:00:00', 6.7], ['1997-07-14 10:00:00', 6.2], ['1997-10-28 10:00:00', 5.8], ['1997-11-24 10:00:00', 6.4], ['1997-12-04 10:00:00', 6.3],
  ['1998-01-08 10:00:00', 7.1], ['1998-02-16 10:00:00', 5.5], ['1998-03-18 10:00:00', 7.9], ['1998-05-21 10:00:00', 6.7], ['1998-07-13 10:00:00', 6.2], ['1998-09-07 10:00:00', 6.1], ['1998-10-14 10:00:00', 5.8], ['1998-11-11 10:00:00', 6.4], ['1998-12-01 10:00:00', 6.3],
  ['1999-01-26 10:00:00', 7.1], ['1999-02-22 10:00:00', 5.5], ['1999-03-18 10:00:00', 7.9], ['1999-05-17 10:00:00', 6.7], ['1999-07-19 10:00:00', 6.2], ['1999-09-14 10:00:00', 6.1], ['1999-10-14 10:00:00', 5.8], ['1999-11-22 10:00:00', 6.4], ['1999-12-06 10:00:00', 6.3],
  ['2000-01-19 10:00:00', 7.1], ['2000-02-09 10:00:00', 5.5], ['2000-03-08 10:00:00', 7.9], ['2000-05-10 10:00:00', 6.7], ['2000-07-24 10:00:00', 6.2], ['2000-09-13 10:00:00', 6.1], ['2000-10-05 10:00:00', 5.8], ['2000-11-08 10:00:00', 6.4], ['2000-12-06 10:00:00', 6.3],
  ['2002-01-29 10:00:00', 7.1], ['2002-02-13 10:00:00', 5.5], ['2002-03-13 10:00:00', 7.9], ['2002-06-06 10:00:00', 7.6], ['2002-09-17 10:00:00', 6.1], ['2002-10-09 10:00:00', 5.8], ['2002-11-19 10:00:00', 6.4], ['2002-12-11 10:00:00', 6.3],
  ['2003-01-15 10:00:00', 7.1], ['2003-02-12 10:00:00', 5.5], ['2003-03-18 10:00:00', 7.9], ['2003-06-17 10:00:00', 7.6], ['2003-09-10 10:00:00', 6.1], ['2003-10-15 10:00:00', 5.8], ['2003-11-12 10:00:00', 6.4], ['2003-12-10 10:00:00', 6.3],
  ['2004-01-14 10:00:00', 7.1], ['2004-02-11 10:00:00', 5.5], ['2004-03-10 10:00:00', 7.9], ['2004-06-16 10:00:00', 7.6], ['2004-09-15 10:00:00', 6.1], ['2004-10-13 10:00:00', 5.8], ['2004-11-17 18:00:00', 6.4], ['2004-12-09 10:00:00', 6.3],
  ['2005-01-12 10:00:00', 7.1], ['2005-02-16 10:00:00', 5.5], ['2005-03-09 10:00:00', 7.9], ['2005-06-15 10:00:00', 7.6], ['2005-09-13 10:00:00', 6.1], ['2005-10-19 10:00:00', 5.8], ['2005-11-16 10:00:00', 6.4], ['2005-12-14 10:00:00', 6.3],
].map(([d,v]) => ({ date: new Date(d), value: v }));

async function main() {
  const lines = [];
  lines.push(section('Test C — Summary'));

  // Normality
  try {
    const a = await shapiroWilkAsync(LakeA_single, alpha);
    lines.push(bulletLine('Shapiro–Wilk (Lake A)', { n: a.n, W: a.W, p_value: a.p_value, normal: a.normal }));
    const b = await shapiroWilkAsync(LakeB, alpha);
    lines.push(bulletLine('Shapiro–Wilk (Lake B)', { n: b.n, W: b.W, p_value: b.p_value, normal: b.normal }));
  } catch (e) {
    lines.push(bulletLine('Shapiro–Wilk', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }

  // Variance test
  try {
    const lev = await leveneTwoSampleAsync(LakeA, LakeB, alpha, 'median');
    lines.push(bulletLine('Levene (A vs B)', { method: lev.method, F: lev.F, df1: lev.df1, df2: lev.df2, p_value: lev.p_value, equal_variances: lev.equal_variances }));
  } catch (e) {
    lines.push(bulletLine('Levene (A vs B)', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }

  // Trend test (Seasonal MK + Sen's slope)
  try {
    const seasonSeries = buildSeasonSeriesFromMonthly(monthlyPointsC, {});
    const mk = await seasonalMK(seasonSeries);
    const sen = sensSlopeCombined(seasonSeries);
    lines.push(bulletLine('Seasonal MK', { n_wet: mk.nWet, n_dry: mk.nDry, S: mk.S, Var: mk.Var, Z: mk.Z, p_value: mk.p_value, direction: mk.direction }));
    lines.push(bulletLine('Sen’s slope', { slope_per_year: sen.slope, intercept: sen.intercept }));
  } catch (e) {
    lines.push(bulletLine('Seasonal MK', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }

  // One-sample tests (A vs 5)
  for (const alt of ['two-sided', 'greater', 'less']) {
    try {
      const t1 = await tOneSampleAsync(LakeA_single, mu0, alpha, alt);
      lines.push(bulletLine(`One-sample t (${alt})`, { n: t1.n, mean: t1.mean, sd: t1.sd, df: t1.df, t: t1.t, p_value: t1.p_value, rejected: t1.rejected }));
    } catch (e) {
      lines.push(bulletLine(`One-sample t (${alt})`, { status: 'SKIPPED', reason: e?.message || String(e) }));
    }
    try {
      const w1 = await wilcoxonSignedRankAsync(LakeA_single, mu0, alpha, alt);
      lines.push(bulletLine(`Wilcoxon signed-rank (${alt})`, { n: w1.n, statistic: w1.statistic, p_value: w1.p_value, rejected: w1.rejected }));
    } catch (e) {
      lines.push(bulletLine(`Wilcoxon signed-rank (${alt})`, { status: 'SKIPPED', reason: e?.message || String(e) }));
    }
    try {
      const s1 = await signTestAsync(LakeA_single, mu0, alpha, alt);
      lines.push(bulletLine(`Sign test (${alt})`, { n: s1.n, k_positive: s1.k_positive, k_negative: s1.k_negative, p_value: s1.p_value, significant: s1.significant }));
    } catch (e) {
      lines.push(bulletLine(`Sign test (${alt})`, { status: 'SKIPPED', reason: e?.message || String(e) }));
    }
  }

  // Equivalence tests (range)
  try {
    const tt = await tostEquivalenceAsync(LakeA_range, lower, upper, alpha);
    const p_max = Math.max(tt.p1, tt.p2);
    lines.push(bulletLine('TOST t', { n: tt.n, mean: tt.mean, sd: tt.sd, df: tt.df, t1: tt.t1, t2: tt.t2, p_lower: tt.p1, p_upper: tt.p2, p_max, equivalent: tt.equivalent }));
  } catch (e) {
    lines.push(bulletLine('TOST t', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }
  try {
    const ww = await tostEquivalenceWilcoxonAsync(LakeA_range, lower, upper, alpha);
    lines.push(bulletLine('TOST Wilcoxon', { n: ww.n, median: ww.median, mean: ww.mean, sd: ww.sd, w_lower: ww.w_lower, w_upper: ww.w_upper, p_lower: ww.p_lower, p_upper: ww.p_upper, p_max: ww.pTOST, equivalent: ww.equivalent }));
  } catch (e) {
    lines.push(bulletLine('TOST Wilcoxon', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }

  // Two-sample tests (A vs B)
  try {
    const ts = await tTwoSampleStudentAsync(LakeA, LakeB, alpha, 'two-sided');
    lines.push(bulletLine('Student t-test', { n1: ts.n1, n2: ts.n2, mean1: ts.mean1, mean2: ts.mean2, sd1: ts.sd1, sd2: ts.sd2, t: ts.t, df: ts.df, p_value: ts.p_value, significant: ts.significant }));
  } catch (e) {
    lines.push(bulletLine('Student t-test', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }
  try {
    const tw = await tTwoSampleWelchAsync(LakeA, LakeB, alpha, 'two-sided');
    lines.push(bulletLine('Welch t-test', { n1: tw.n1, n2: tw.n2, mean1: tw.mean1, mean2: tw.mean2, sd1: tw.sd1, sd2: tw.sd2, t: tw.t, df: tw.df, p_value: tw.p_value, significant: tw.significant }));
  } catch (e) {
    lines.push(bulletLine('Welch t-test', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }
  try {
    const mw = await mannWhitneyAsync(LakeA, LakeB, alpha, 'two-sided');
    lines.push(bulletLine('Mann–Whitney U', { n1: mw.n1, n2: mw.n2, U: mw.U, U1: mw.U1, U2: mw.U2, z: mw.z, p_value: mw.p_value, significant: mw.significant }));
  } catch (e) {
    lines.push(bulletLine('Mann–Whitney U', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }
  try {
    const mm = await moodMedianAsync(LakeA, LakeB, alpha);
    lines.push(bulletLine("Mood’s median", { median_global: mm.median, chi2: mm.chi2, df: mm.df, p_value: mm.p_value, significant: mm.significant }));
  } catch (e) {
    lines.push(bulletLine("Mood’s median", { status: 'SKIPPED', reason: e?.message || String(e) }));
  }

  print(lines);
}

main().catch(e => { console.error(e); process.exitCode = 1; });

