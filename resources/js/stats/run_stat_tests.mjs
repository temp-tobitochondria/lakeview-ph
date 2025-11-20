// Test runner for statistical tests using existing helpers.
// Run with: `node --input-type=module resources/js/stats/run_stat_tests.mjs`

import * as path from 'path';
const alpha = 0.05;
const mu0 = 5;
const data = [3.2, 3.5, 3.8, 4.1, 3.9, 3.7, 4.5, 4.8, 3.6, 3.3, 3.1, 4];

function mean(arr){ return arr.reduce((s,v)=>s+v,0)/arr.length; }
function median(arr){ const s=[...arr].sort((a,b)=>a-b); const n=s.length; return n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2; }
function sd(arr){ const m=mean(arr); const v=arr.reduce((s,x)=>s+(x-m)*(x-m),0)/(arr.length-1); return Math.sqrt(v); }
function normalCdf(x){ // Abramowitz-Stegun approx
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x)/Math.SQRT2;
  const t = 1/(1+p*z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
  const erf = sign * y;
  return 0.5 * (1 + erf);
}

async function tryImportUtils(){
  try {
    const stats = await import('./statsUtils.js');
    const mk = await import('./seasonalMK.js');
    return { stats, mk };
  } catch (e){
    console.error('Failed to import local modules:', e.message || e);
    throw e;
  }
}

// Local binomial tail (CDF) using log-domain to avoid overflow
function logFactorial(n){ let s=0; for(let i=2;i<=n;i++) s += Math.log(i); return s; }
function logComb(n,k){ return logFactorial(n) - logFactorial(k) - logFactorial(n-k); }
function binomCdf(k, n, p){ // P(X <= k)
  let sum = 0;
  for(let i=0;i<=k;i++){
    const logp = logComb(n,i) + i*Math.log(p) + (n-i)*Math.log(1-p);
    sum += Math.exp(logp);
  }
  return Math.min(1, Math.max(0, sum));
}

(async ()=>{
  const out = {
    mean: mean(data),
    median: median(data),
    alpha,
    mu0,
    tests: {}
  };

  const { stats, mk } = await tryImportUtils();

  // Shapiro-Wilk (synchronous implementation available)
  try {
    const sw = stats.shapiroWilk(data, alpha);
    out.tests.shapiroWilk = { p_value: sw.p_value, W: sw.W, normal: sw.normal };
  } catch (e){ out.tests.shapiroWilk = { error: String(e) }; }

  // One-sample t-test: attempt to use async helper, else approximate with normal
  out.tests.tTest = {};
  const alts = ['two-sided','greater','less'];
  for (const alt of alts){
    try {
      const res = await stats.tOneSampleAsync(data, mu0, alpha, alt);
      out.tests.tTest[alt] = { p_value: res.p_value, t: res.t, df: res.df };
    } catch (e){
      // fallback approximate via normal for moderate n
      const n = data.length; const m = mean(data); const s = sd(data); const t = (m - mu0)/(s/Math.sqrt(n));
      const z = Math.abs(t);
      const pTwo = 2*(1 - normalCdf(z));
      let p;
      if (alt === 'two-sided') p = pTwo; else if (alt === 'greater') p = 1 - normalCdf(t); else p = normalCdf(t);
      out.tests.tTest[alt] = { p_value: p, t, note: 'approximate normal fallback' };
    }
  }

  // Wilcoxon signed-rank
  out.tests.wilcoxon = {};
  for (const alt of alts){
    try {
      const res = await stats.wilcoxonSignedRankAsync(data, mu0, alpha, alt === 'two-sided' ? 'two-sided' : (alt === 'greater' ? 'greater' : 'less'));
      out.tests.wilcoxon[alt] = { p_value: res.p_value ?? res.p_lower ?? res.p_upper ?? res.p, statistic: res.statistic ?? res.w_lower ?? null };
    } catch (e){
      out.tests.wilcoxon[alt] = { error: 'Wilcoxon unavailable: ' + String(e.message || e) };
    }
  }

  // Sign test (binomial)
  out.tests.signTest = {};
  for (const alt of alts){
    try {
      const res = await stats.signTestAsync(data, mu0, alpha, alt === 'two-sided' ? 'two-sided' : (alt === 'greater' ? 'greater' : 'less'));
      out.tests.signTest[alt] = { p_value: res.p_value, n: res.n, k_positive: res.k_positive };
    } catch (e){
      // fallback exact binomial on number of positives
      try {
        let pos = 0, neg = 0;
        for (const v of data){ const d = v - mu0; if (Math.abs(d) < 1e-12) continue; if (d>0) pos++; else neg++; }
        const n = pos + neg; const k = pos; const p0 = 0.5;
        let p;
        if (alt === 'greater') p = 1 - binomCdf(k-1, n, p0);
        else if (alt === 'less') p = binomCdf(k, n, p0);
        else { const lower = Math.min(binomCdf(k, n, p0), binomCdf(n-k, n, p0)); p = Math.min(1, 2*lower); }
        out.tests.signTest[alt] = { p_value: p, n, k_positive: k, note: 'fallback exact binomial' };
      } catch (ee){ out.tests.signTest[alt] = { error: String(ee) }; }
    }
  }

  // Mann-Kendall + Sen's slope
  try {
    // prepare seasonSeries compatible with seasonalMK: put all points in wet array with year field
    const seasonSeries = { wet: data.map((v,i)=>({ year: i+1, value: v })), dry: [] };
    const mkRes = await mk.seasonalMK(seasonSeries);
    // prepare time-series for sensSlopeGeneral
    const ts = data.map((v,i)=>({ t: i+1, value: v }));
    const sen = mk.sensSlopeGeneral(ts);
    out.tests.mannKendall = { S: mkRes.S, Var: mkRes.Var, Z: mkRes.Z, p_value: mkRes.p_value, direction: mkRes.direction };
    out.tests.theilSen = { slope: sen.slope, intercept: sen.intercept };
  } catch (e){ out.tests.mannKendall = { error: String(e) }; }

  // Print summary
  console.log('\n=== Test results (alpha=0.05, mu0=7) ===\n');
  console.log('Mean:', out.mean.toFixed(4));
  console.log('Median:', out.median.toFixed(4));
  console.log('\nShapiro-Wilk p:', out.tests.shapiroWilk?.p_value);

  console.log('\nOne-sample t-test p-values:');
  for (const k of Object.keys(out.tests.tTest)) console.log(`  ${k}: ${out.tests.tTest[k].p_value}`);

  console.log('\nWilcoxon signed-rank p-values:');
  for (const k of Object.keys(out.tests.wilcoxon)) console.log(`  ${k}:`, out.tests.wilcoxon[k]);

  console.log('\nSign test p-values:');
  for (const k of Object.keys(out.tests.signTest)) console.log(`  ${k}:`, out.tests.signTest[k]);

  console.log('\nMann-Kendall:', out.tests.mannKendall);
  console.log('Theil-Sen slope:', out.tests.theilSen);

})();
