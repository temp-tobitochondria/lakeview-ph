// Equivalence test runner: Shapiro-Wilk and TOST (t and Wilcoxon)
// Run with: node resources/js/stats/run_equiv_tests.mjs

import * as stats from './statsUtils.js';

const alpha = 0.05;
const lower = 6.5;
const upper = 9;
const data = [7.8, 7.8, 8, 7.9, 8.4, 8.6, 8.5, 8.2, 8.5, 8.6, 8.1, 8.2, 8.2, 8.4, 8.4, 8.1, 8.6, 9.4, 9.1, 8.8, 8.7, 8.1, 8.6, 9.4, 7.8, 8, 8.4, 8, 8.5, 8.4];

function mean(arr){ return arr.reduce((s,v)=>s+v,0)/arr.length; }
function median(arr){ const s=[...arr].sort((a,b)=>a-b); const n=s.length; return n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2; }

(async ()=>{
  console.log('\n=== Equivalence tests (alpha=0.05, bounds: '+lower+'..'+upper+') ===\n');
  console.log('N:', data.length);
  console.log('Mean:', mean(data).toFixed(4));
  console.log('Median:', median(data).toFixed(4));

  // Shapiro-Wilk
  try{
    const sw = stats.shapiroWilk(data, alpha);
    console.log('\nShapiro-Wilk: W=', sw.W.toFixed(4), ' p=', sw.p_value);
  } catch(e){ console.log('Shapiro-Wilk error:', e); }

  // TOST (t)
  try{
    const tostT = await stats.tostEquivalenceAsync(data, lower, upper, alpha);
    console.log('\nTOST (t) results:');
    console.log('  t1=', tostT.t1, ' t2=', tostT.t2);
    console.log('  p1=', tostT.p1, ' p2=', tostT.p2, ' pTOST=', tostT.pTOST, ' equivalent=', !!tostT.equivalent);
  } catch(e){ console.log('TOST (t) error:', e.message || e); }

  // TOST (Wilcoxon)
  try{
    const tostW = await stats.tostEquivalenceWilcoxonAsync(data, lower, upper, alpha);
    console.log('\nTOST (Wilcoxon) results:');
    console.log('  n=', tostW.n, ' mean=', tostW.mean.toFixed(4), ' median=', tostW.median.toFixed(4));
    console.log('  p_lower=', tostW.p_lower, ' p_upper=', tostW.p_upper, ' pTOST=', tostW.pTOST, ' equivalent=', !!tostW.equivalent);
  } catch(e){ console.log('TOST (Wilcoxon) error:', e.message || e); }

})();
