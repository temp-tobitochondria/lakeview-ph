// Run two-sample tests using existing helpers
// Run: node resources/js/stats/run_group_tests.mjs

import * as stats from './statsUtils.js';

const alpha = 0.05;
const groupA = [0.013, 1.773, 0.883, 1.708, 0.254, 0.641, 0.685, 0.5717, 0.2671, 0.4299, 0.5808, 1.651, 0.1632, 0.5935, 0.5101, 2.5864, 0.8538, 0.0108, 0.936, 2.03, 0.419, 0.917, 0.5887, 1.68, 4.257, 0.5642, 0.6381, 3.698, 2.216, 2.6832, 2.2208, 3.5324, 2.5487, 2.3825, 2.7456, 1.442, 1.3552, 0.8944, 0.211, 1.1788, 2.128, 6.8148, 6.2897, 5.7404, 4.6299, 2.2232, 2.8581, 0.5188, 1.9632, 2.091, 6.2879, 1.773, 2.3384, 9.6856, 3.007, 3.4023, 2.0427, 4.6312, 1.69, 2.4128, 3.9486, 5.8225, 6.9996, 8.3342, 4.5264, 2.1793, 5.071, 4.2739, 0.3751, 3.02, 0.798, 3.068, 3.8024];
const groupB = [0.288, 1.071, 0.234, 0.459, 0.002, 0.35, 0.372, 0.3423, 0.01, 0.1467, 0.075, 0.139, 0.0646, 0.1983, 2.2343, 0.9781, 0.846, 0.9791, 0.8841, 0.363, 0.298, 0.652, 0.1935, 0.834, 2.0405, 0.8258, 0.7177, 0.6118, 0.9496, 1.501, 0.7852, 0.5434, 0.0405, 1.2642, 1.1838, 1.6238, 1.055, 0.3315, 0.6302, 0.751, 1.2276, 1.5605, 4.4152, 3.742, 3.0175, 0.8366, 1.1225, 1.434, 0.9365, 2.0205, 1.4988, 3.447, 1.5233, 0.2399, 3.1068, 1.7868, 0.5689, 0.806, 1.1543, 1.7521, 1.0118, 1.1834, 2.5039, 0.6293, 2.8217, 2.5256, 1.225, 1.008, 0.8689, 0.7857, 2.9149, 0.3232, 0.5454, 3.8971, 3.8518, 0.9373, 1.0771, 1.2073, 1.9671, 0.8586, 2.5102, 1.0662, 2.776, 0.1008, 2.434];

function mean(a){ return a.reduce((s,v)=>s+v,0)/a.length; }
function median(a){ const s=[...a].sort((x,y)=>x-y); const n=s.length; const m=Math.floor(n/2); return n%2? s[m] : (s[m-1]+s[m])/2; }

(async ()=>{
  console.log('\n=== Two-sample tests (alpha=0.05) ===\n');
  console.log('Group A: n=', groupA.length, ' mean=', mean(groupA).toFixed(4), ' median=', median(groupA).toFixed(4));
  console.log('Group B: n=', groupB.length, ' mean=', mean(groupB).toFixed(4), ' median=', median(groupB).toFixed(4));

  // Shapiro-Wilk for each group (synchronous function available)
  try {
    const swA = stats.shapiroWilk(groupA, alpha);
    const swB = stats.shapiroWilk(groupB, alpha);
    console.log('\nShapiro-Wilk:');
    console.log('  Group A p =', swA.p_value);
    console.log('  Group B p =', swB.p_value);
  } catch (e) { console.log('Shapiro-Wilk error:', e); }

  // Levene test (async)
  let leveneRes;
  try {
    leveneRes = await stats.leveneTestAsync([groupA, groupB], alpha, 'median');
    console.log('\nLevene (Brown-Forsythe) p-value =', leveneRes.p_value);
  } catch (e) { console.log('Levene error:', e.message || e); }

  // Student t-test (pooled)
  try {
    const stud = await stats.tTwoSampleStudentAsync(groupA, groupB, alpha, 'two-sided');
    console.log('\nStudent t-test (pooled) p-value =', stud.p_value);
  } catch (e) { console.log('Student t error:', e.message || e); }

  // Welch t-test
  try {
    const welch = await stats.tTwoSampleWelchAsync(groupA, groupB, alpha, 'two-sided');
    console.log('\nWelch t-test p-value =', welch.p_value);
  } catch (e) { console.log('Welch t error:', e.message || e); }

  // Mann-Whitney U
  try {
    const mw = await stats.mannWhitneyAsync(groupA, groupB, alpha, 'two-sided');
    console.log('\nMann-Whitney U test p-value =', mw.p_value);
  } catch (e) { console.log('Mann-Whitney error:', e.message || e); }

  // Mood's median test
  try {
    const mood = await stats.moodMedianAsync(groupA, groupB, alpha);
    console.log('\nMood\'s median test p-value =', mood.p_value);
  } catch (e) { console.log('Mood median error:', e.message || e); }

})();
