#!/usr/bin/env node
// Test Case B runner (Laguna de Bay 2024 vs thresholds; vs Taal Lake 2024)

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

// ---------------------- Mock Data (B) ----------------------
// One-sample threshold (BOD vs 7)
const LakeA_single = [
  1, 2, 2, 2, 2, 2, 1, 2, 1, 2, 1, 1, 1, 2, 2, 4, 3, 6, 2, 4, 4, 7, 4, 4, 4, 2, 3, 3, 3, 3, 2, 4, 4, 6, 6, 4, 2, 2, 2, 2, 2, 2, 2, 3, 3, 4, 4
];
const mu0 = 7;

// Range threshold (BOD 6.5 - 9 per the note)
const LakeA_range = [
  8.2, 8.1, 8.4, 8.3, 8.5, 8.4, 8.5, 8.4, 8.4, 8.3, 8.7, 8.2, 8.1, 8.3, 8.1, 9.4, 8.7, 9.3, 8.6, 9.1, 7.7, 9.4, 9.2, 8.9, 9, 8.8, 9.1, 8.8, 7.8, 7.6, 7.8, 8.9, 8.7, 7.8, 7.7, 8, 7.9, 8.1, 8.7, 8.6, 7.6, 7.8, 7.3, 7.4, 7.6, 9.4, 7.8
];
const lower = 6.5, upper = 9;

// Lake vs Lake (Laguna de Bay vs Taal Lake)
const LakeA = [...LakeA_single];
const LakeB = [ 3.2, 3.5, 3.8, 4.1, 3.9, 3.7, 4.5, 4.8, 3.6, 3.3, 3.1, 4 ];

// Seasonal MK: build monthly points for 2024 (Laguna de Bay, 4 stations per month)
const monthlyPointsB = [
  ['2024-01-01 10:00:00', 2], ['2024-01-01 10:00:00', 2], ['2024-01-01 10:00:00', 1], ['2024-01-01 10:00:00', 2],
  ['2024-02-01 10:00:00', 2], ['2024-02-01 10:00:00', 1], ['2024-02-01 10:00:00', 2], ['2024-02-01 10:00:00', 2],
  ['2024-03-01 10:00:00', 1], ['2024-03-01 10:00:00', 2], ['2024-03-01 10:00:00', 1], ['2024-03-01 10:00:00', 1],
  ['2024-04-01 10:00:00', 2], ['2024-04-01 10:00:00', 2], ['2024-04-01 10:00:00', 1],
  ['2024-05-01 10:00:00', 4], ['2024-05-01 10:00:00', 6], ['2024-05-01 10:00:00', 2], ['2024-05-01 10:00:00', 3],
  ['2024-06-01 10:00:00', 4], ['2024-06-01 10:00:00', 7], ['2024-06-01 10:00:00', 4], ['2024-06-01 10:00:00', 4],
  ['2024-07-01 10:00:00', 4], ['2024-07-01 10:00:00', 4], ['2024-07-01 10:00:00', 2], ['2024-07-01 10:00:00', 3],
  ['2024-08-01 10:00:00', 3], ['2024-08-01 10:00:00', 3], ['2024-08-01 10:00:00', 3], ['2024-08-01 10:00:00', 2],
  ['2024-09-01 10:00:00', 4], ['2024-09-01 10:00:00', 6], ['2024-09-01 10:00:00', 4], ['2024-09-01 10:00:00', 6],
  ['2024-10-01 10:00:00', 2], ['2024-10-01 10:00:00', 2], ['2024-10-01 10:00:00', 2], ['2024-10-01 10:00:00', 4],
  ['2024-11-01 10:00:00', 2], ['2024-11-01 10:00:00', 2], ['2024-11-01 10:00:00', 2], ['2024-11-01 10:00:00', 2],
  ['2024-12-01 10:00:00', 3], ['2024-12-01 10:00:00', 3], ['2024-12-01 10:00:00', 4], ['2024-12-01 10:00:00', 4],
].map(([d,v]) => ({ date: new Date(d), value: v }));

async function main() {
  const lines = [];
  lines.push(section('Test B — Summary'));

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
    const seasonSeries = buildSeasonSeriesFromMonthly(monthlyPointsB, {});
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

