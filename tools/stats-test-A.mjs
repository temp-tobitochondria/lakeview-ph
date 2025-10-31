#!/usr/bin/env node
// Test Case A runner
// Uses app stats modules and prints bullet-form results per requirements.

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

// ---------------------- Mock Data (A) ----------------------
// One-sample threshold (BOD vs 7)
const LakeA_single = [
  3.6, 5.3, 4.7, 2.5, 1.9, 1.3, 1.8, 5.7, 3.4, 3.8, 2.3, 3.5, 3, 2.8, 9, 8, 5, 7, 5, 7, 8, 8, 5, 5, 20, 4, 6, 4, 6, 7, 6, 5, 5, 4, 9, 4, 7, 6, 5, 10, 6, 6, 9, 6, 5, 3, 6, 5, 4, 4, 7, 6, 11, 7, 10, 7, 7, 7, 7, 2, 7, 7, 5, 8, 7, 8, 7, 5, 11, 8, 5, 5, 2, 14, 10, 6, 4, 4, 17, 4, 27, 6, 10, 11, 9
];
const mu0 = 7;

// Range threshold (pH 6.5 - 8.5)
const LakeA_range = [
  7.5, 7.9, 8.1, 8.8, 8.9, 8.6, 8, 7.4, 8.6, 8, 8.5, 7.5, 7.6, 7.9, 7.3, 7.5, 7.3, 7.6, 7.3, 7.4, 7.2, 7.1, 7.1, 6.8, 7, 7.1, 7.7, 7.2, 7.3, 7.1, 6.8, 6.9, 7, 7, 6.7, 7.1, 7.2, 7.2, 7.3, 7.1, 7.3, 7, 7, 6.9, 7.3, 7.4, 8.7, 9.3, 9, 7.9, 7.4, 7.8, 7, 7.3, 7.6, 7.2, 7.1, 7.1, 8.2, 7.6, 7, 7.1, 8.1, 7.3, 6.7, 7.2, 6.6, 7, 7.3, 6.9, 8.5, 8.4, 7.2, 8.1, 8.3, 6.9, 6.7, 7.6, 7.4, 7.2, 7.1, 7.7, 7.3, 7.8, 7, 7, 7
];
const lower = 6.5, upper = 8.5;

// Lake vs Lake (BOD)
const LakeA = [...LakeA_single];
const LakeB = [
  7, 6, 13, 7, 5, 5, 4, 34, 6, 6, 6, 10, 5, 8, 8, 20, 5, 5, 7, 11, 9, 8, 16, 18, 36, 9, 9, 5, 7, 30, 6, 5, 6, 15, 7, 4, 8, 7, 10, 11, 13, 10, 5, 19, 8, 9, 10, 14, 3, 9, 8, 11, 10, 10, 16, 8, 13, 8, 6, 1, 14, 14, 13, 11, 15, 10, 12, 14, 18, 9, 14, 14
];

// Seasonal MK monthly points (from Test A CSV, Sampaloc Lake station 2)
const monthlyPointsA = [
  { d: '1996-01-17 10:00:00', v: 3.6 },
  { d: '1996-02-21 10:00:00', v: 5.3 },
  { d: '1996-03-28 10:00:00', v: 4.7 },
  { d: '1996-06-18 10:00:00', v: 2.5 },
  { d: '1996-09-09 10:00:00', v: 1.9 },
  { d: '1996-11-28 10:00:00', v: 1.3 },
  { d: '1996-12-18 10:00:00', v: 1.8 },
  { d: '1997-01-09 10:00:00', v: 5.7 },
  { d: '1997-02-06 10:00:00', v: 3.4 },
  { d: '1997-03-03 10:00:00', v: 3.8 },
  { d: '1997-05-07 10:00:00', v: 2.3 },
  { d: '1997-07-21 10:00:00', v: 3.5 },
  { d: '1997-10-27 10:00:00', v: 3.0 },
  { d: '1997-11-27 10:00:00', v: 2.8 },
  { d: '1997-12-15 10:00:00', v: 9.0 },
  { d: '1998-01-13 10:00:00', v: 8.0 },
  { d: '1998-02-17 10:00:00', v: 5.0 },
  { d: '1998-03-19 10:00:00', v: 7.0 },
  { d: '1998-05-06 10:00:00', v: 5.0 },
  { d: '1998-07-08 10:00:00', v: 7.0 },
  { d: '1998-09-02 10:00:00', v: 8.0 },
  { d: '1998-10-07 10:00:00', v: 8.0 },
  { d: '1998-11-24 10:00:00', v: 5.0 },
  { d: '1998-12-15 10:00:00', v: 5.0 },
  { d: '1999-01-27 10:00:00', v: 20.0 },
  { d: '1999-02-23 10:00:00', v: 4.0 },
  { d: '1999-03-19 10:00:00', v: 6.0 },
  { d: '1999-05-24 10:00:00', v: 4.0 },
  { d: '1999-07-14 10:00:00', v: 6.0 },
  { d: '1999-09-27 10:00:00', v: 7.0 },
  { d: '1999-10-25 10:00:00', v: 6.0 },
  { d: '1999-11-11 10:00:00', v: 5.0 },
  { d: '1999-12-09 10:00:00', v: 5.0 },
  { d: '2000-01-13 10:00:00', v: 4.0 },
  { d: '2000-02-02 10:00:00', v: 9.0 },
  { d: '2000-03-02 10:00:00', v: 4.0 },
  { d: '2000-05-04 10:00:00', v: 7.0 },
  { d: '2000-07-17 10:00:00', v: 6.0 },
  { d: '2000-08-15 10:00:00', v: 5.0 },
  { d: '2000-09-14 10:00:00', v: 10.0 },
  { d: '2000-10-10 10:00:00', v: 6.0 },
  { d: '2000-11-16 10:00:00', v: 6.0 },
  { d: '2000-12-06 10:00:00', v: 9.0 },
  // 2001 missing in the provided snippet
  { d: '2002-01-24 10:00:00', v: 6.0 },
  { d: '2002-02-28 10:00:00', v: 5.0 },
  { d: '2002-03-14 10:00:00', v: 3.0 },
  { d: '2002-04-11 10:00:00', v: 6.0 },
  { d: '2002-05-15 10:00:00', v: 5.0 },
  { d: '2002-06-18 10:00:00', v: 4.0 },
  { d: '2002-07-16 10:00:00', v: 4.0 },
  { d: '2002-08-15 10:00:00', v: 7.0 },
  { d: '2002-09-11 10:00:00', v: 6.0 },
  { d: '2002-10-08 10:00:00', v: 11.0 },
  { d: '2002-11-12 10:00:00', v: 7.0 },
  { d: '2003-01-14 10:00:00', v: 10.0 },
  { d: '2003-02-11 10:00:00', v: 7.0 },
  { d: '2003-03-11 10:00:00', v: 7.0 },
  { d: '2003-04-10 10:00:00', v: 7.0 },
  { d: '2003-05-13 10:00:00', v: 7.0 },
  { d: '2003-06-19 10:00:00', v: 2.0 },
  { d: '2003-07-15 10:00:00', v: 7.0 },
  { d: '2003-08-12 10:00:00', v: 7.0 },
  { d: '2003-09-09 10:00:00', v: 5.0 },
  { d: '2003-10-14 10:00:00', v: 8.0 },
  { d: '2003-11-11 10:00:00', v: 7.0 },
  { d: '2003-12-09 10:00:00', v: 8.0 },
  { d: '2004-01-13 10:00:00', v: 7.0 },
  { d: '2004-02-10 10:00:00', v: 5.0 },
  { d: '2004-03-09 10:00:00', v: 11.0 },
  { d: '2004-04-21 10:00:00', v: 8.0 },
  { d: '2004-06-15 10:00:00', v: 5.0 },
  { d: '2004-07-13 10:00:00', v: 5.0 },
  { d: '2004-08-10 10:00:00', v: 2.0 },
  { d: '2004-09-14 10:00:00', v: 14.0 },
  { d: '2004-10-12 10:00:00', v: 10.0 },
  { d: '2004-11-17 10:00:00', v: 6.0 },
  { d: '2004-12-14 10:00:00', v: 4.0 },
  { d: '2005-01-11 10:00:00', v: 4.0 },
  { d: '2005-02-15 10:00:00', v: 17.0 },
  { d: '2005-03-08 10:00:00', v: 4.0 },
  { d: '2005-06-14 10:00:00', v: 27.0 },
  { d: '2005-09-08 10:00:00', v: 6.0 },
  { d: '2005-10-18 10:00:00', v: 10.0 },
  { d: '2005-11-15 10:00:00', v: 11.0 },
  { d: '2005-12-13 10:00:00', v: 9.0 },
];

function toMonthlyPoints(rows){
  return rows.map(r => ({ date: new Date(r.d), value: r.v }));
}

async function main() {
  const lines = [];
  lines.push(section('Test A — Summary'));

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
    const monthly = toMonthlyPoints(monthlyPointsA);
    const seasonSeries = buildSeasonSeriesFromMonthly(monthly, {});
    const mk = await seasonalMK(seasonSeries);
    const sen = sensSlopeCombined(seasonSeries);
    lines.push(bulletLine('Seasonal MK', { n_wet: mk.nWet, n_dry: mk.nDry, S: mk.S, Var: mk.Var, Z: mk.Z, p_value: mk.p_value, direction: mk.direction }));
    lines.push(bulletLine('Sen’s slope', { slope_per_year: sen.slope, intercept: sen.intercept }));
  } catch (e) {
    lines.push(bulletLine('Seasonal MK', { status: 'SKIPPED', reason: e?.message || String(e) }));
  }

  // One-sample tests (A vs 7)
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

