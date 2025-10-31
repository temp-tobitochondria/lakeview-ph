#!/usr/bin/env node
// Build cross-validation tables by running Node tests and matching R outputs.
// Produces per-test folders and zips with:
// - lakeview.json (p-values from Node runner)
// - r-out.json (p-values from R script)
// - table.csv and table.md
// - the R script used

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = process.cwd();
const tests = {
  A: {
    node: 'tools/stats-test-A.mjs',
    r: 'tools/crossval/R/test-A.R',
  },
  B: {
    node: 'tools/stats-test-B.mjs',
    r: 'tools/crossval/R/test-B.R',
  },
  C: {
    node: 'tools/stats-test-C.mjs',
    r: 'tools/crossval/R/test-C.R',
  }
};

function pfmt(p){
  if (p === null || p === undefined) return String(p);
  if (!Number.isFinite(p)) return String(p);
  if (p < 0.001) return `<0.001 (p=${p.toPrecision(12)}; ${p.toExponential(2)})`;
  if (p > 0.999) return `>0.999 (p=${p.toFixed(6)})`;
  return p.toFixed(6);
}

function normalizeUnicode(s){
  return s
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'");
}

function parseLakeView(stdout){
  // Map test label -> p-value as printed string
  const out = {};
  const rawLines = String(stdout).split(/\r?\n/);
  const lines = rawLines.map(normalizeUnicode);
  const pick = (label, key='p_value') => {
    const re = new RegExp(`^\- ${label}: .*?${key}=([^,]+)`);
    for (const l of lines){
      const m = re.exec(l);
      if (m) return m[1].trim();
    }
    return null;
  };
  // Shapiro (Lake A)
  {
    const l = lines.find(s => s.startsWith('- Shapiro-Wilk (Lake A): '));
    if (l) out['Shapiro-Wilk'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['Shapiro-Wilk'] = null;
  }
  // Levene (A vs B)
  {
    const l = lines.find(s => s.startsWith('- Levene (A vs B): '));
    if (l) out['Levene (Brown-Forsythe)'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['Levene (Brown-Forsythe)'] = null;
  }
  out['Seasonal Mann-Kendall'] = pick('Seasonal MK');
  out["Sen's Slope"] = 'N/A';
  {
    const l = lines.find(s => s.startsWith('- One-sample t (less): '));
    if (l) out['One Sample t-test (Less)'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['One Sample t-test (Less)'] = null;
  }
  {
    const l = lines.find(s => s.startsWith('- Wilcoxon signed-rank (less): '));
    if (l) out['Wilcoxon Signed-Rank (Less)'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['Wilcoxon Signed-Rank (Less)'] = null;
  }
  {
    const l = lines.find(s => s.startsWith('- Sign test (less): '));
    if (l) out['Sign Test (Less)'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['Sign Test (Less)'] = null;
  }
  out['Equivalence TOST t'] = pick('TOST t', 'p_max');
  out['Equivalence TOST Wilcoxon'] = pick('TOST Wilcoxon', 'p_max');
  {
    const l = lines.find(s => s.startsWith('- Student t-test: '));
    if (l) out['Student t-test'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['Student t-test'] = null;
  }
  {
    const l = lines.find(s => s.startsWith('- Welch t-test: '));
    if (l) out['Welch t-test'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['Welch t-test'] = null;
  }
  {
    const l = lines.find(s => s.startsWith('- Mann-Whitney U: '));
    if (l) out['Mann-Whitney U'] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out['Mann-Whitney U'] = null;
  }
  {
    const l = lines.find(s => s.startsWith("- Mood's median: "));
    if (l) out["Mood's Median"] = (l.match(/p_value=([^,]+)/) || [])[1]?.trim() || null; else out["Mood's Median"] = null;
  }
  return out;
}

function runNode(testFile){
  const out = execFileSync('node', [testFile], { encoding: 'utf8' });
  return out;
}

function runR(rfile, outJson, monthlyCsv){
  const args = [rfile, outJson];
  if (monthlyCsv) args.push(monthlyCsv);
  const r = spawnSync('Rscript', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`Rscript failed: ${r.stderr || r.stdout}`);
  }
  return readFileSync(outJson, 'utf8');
}

function toCSV(rows){
  const header = 'Test,LakeView p-value,R p-value,Remarks';
  const body = rows.map(r => [r.test, r.lv, r.rp, r.remarks].join(','));
  return [header, ...body].join('\n');
}

function toMD(rows){
  const header = '| Test | LakeView p-value | R p-value | Remarks |';
  const sep = '|---|---|---|---|';
  const body = rows.map(r => `| ${r.test} | ${r.lv} | ${r.rp} | ${r.remarks} |`);
  return [header, sep, ...body].join('\n');
}

const remarksMap = {
  'Shapiro-Wilk': 'Lake A sample',
  'Levene (Brown-Forsythe)': 'A vs B (median-centered)',
  'Seasonal Mann-Kendall': 'PAGASA Wet/Jun–Nov, Dry/Dec–May',
  "Sen's Slope": 'Estimate only; no p-value',
  'One Sample t-test (Less)': 'A vs threshold (less)',
  'Wilcoxon Signed-Rank (Less)': 'Ties dropped',
  'Sign Test (Less)': 'Binomial, ties dropped',
  'Equivalence TOST t': 'p_max reported; alpha=0.05',
  'Equivalence TOST Wilcoxon': 'Lower: >, Upper: <; p_max',
  'Student t-test': 'Two-sided',
  'Welch t-test': 'Two-sided',
  'Mann-Whitney U': 'Two-sided, normal approx',
  "Mood's Median": '2x2 chi-square on pooled median'
};

function extractMonthlyCsv(letter, nodeFile, outDir){
  const src = readFileSync(nodeFile, 'utf8');
  const varName = letter === 'A' ? 'monthlyPointsA' : (letter === 'B' ? 'monthlyPointsB' : 'monthlyPointsC');
  const re = new RegExp(`const ${varName} = \\[(.*?)\\];`, 's');
  const m = src.match(re);
  if (!m) return null;
  const inner = m[1];
  const rx = /\{\s*d:\s*'([^']+)'\s*,\s*v:\s*([0-9.]+)\s*\}/g;
  const rows = [];
  let a;
  while ((a = rx.exec(inner))) rows.push({ date: a[1], value: Number(a[2]) });
  if (!rows.length) return null;
  const path = join(outDir, 'monthly.csv');
  const csv = ['date,value', ...rows.map(r => `${r.date},${r.value}`)].join('\n');
  writeFileSync(path, csv, 'utf8');
  return path;
}

function buildFor(letter){
  const cfg = tests[letter];
  const baseDir = join(root, 'tools', 'crossval', letter);
  mkdirSync(baseDir, { recursive: true });

  // Run Node test and parse
  const nodeOut = runNode(cfg.node);
  writeFileSync(join(baseDir, 'lakeview.out.txt'), nodeOut, 'utf8');
  const lv = parseLakeView(nodeOut);
  writeFileSync(join(baseDir, 'lakeview.json'), JSON.stringify(lv, null, 2));

  // Run R and read JSON
  const rJsonPath = join(baseDir, 'r-out.json');
  const monthlyCsv = extractMonthlyCsv(letter, cfg.node, baseDir);
  runR(cfg.r, rJsonPath, monthlyCsv);
  const rMap = JSON.parse(readFileSync(rJsonPath, 'utf8'));

  const order = [
    'Shapiro-Wilk',
    'Levene (Brown-Forsythe)',
    'Seasonal Mann-Kendall',
    "Sen's Slope",
    'One Sample t-test (Less)',
    'Wilcoxon Signed-Rank (Less)',
    'Sign Test (Less)',
    'Equivalence TOST t',
    'Equivalence TOST Wilcoxon',
    'Student t-test',
    'Welch t-test',
    'Mann-Whitney U',
    "Mood's Median"
  ];

  function parseNum(str){
    if (!str) return NaN;
    const s = String(str);
    const m = s.match(/p=([0-9]+\.[0-9eE+-]+)/);
    if (m) return Number(m[1]);
    if (s.startsWith('<0.001')) return 0; // treat as near-zero
    if (s.startsWith('>0.999')) return 1;
    const f = Number(s);
    return Number.isFinite(f) ? f : NaN;
  }

  const rows = order.map(key => {
    const lvStr = lv[key] ?? '';
    const rVal = rMap[key];
    const rpStr = (key === "Sen's Slope") ? 'N/A' : pfmt(Number(rVal));
    let remark = remarksMap[key] || '';
    if (key !== "Sen's Slope"){
      const lvNum = parseNum(lvStr);
      const rNum = Number(rVal);
      if (Number.isFinite(lvNum) && Number.isFinite(rNum)){
        const diff = Math.abs(lvNum - rNum);
        remark += diff < 1e-12 ? ' • Match' : ` • Δ=${diff.toExponential(2)}`;
      }
    }
    return { test: key, lv: lvStr || '', rp: rpStr, remarks: remark };
  });

  const csv = toCSV(rows);
  const md = toMD(rows);
  writeFileSync(join(baseDir, 'table.csv'), csv, 'utf8');
  writeFileSync(join(baseDir, 'table.md'), md, 'utf8');

  // Copy R script alongside for packaging convenience
  const rScriptTarget = join(baseDir, `script-${letter}.R`);
  const rScriptSrc = join(root, cfg.r);
  const src = readFileSync(rScriptSrc, 'utf8');
  writeFileSync(rScriptTarget, src, 'utf8');

  // Zip folder
  const zipName = join(root, 'tools', 'crossval', `test-${letter}.zip`);
  const zip = spawnSync('zip', ['-r', '-q', zipName, letter], { cwd: join(root, 'tools', 'crossval') });
  if (zip.status !== 0) throw new Error(`zip failed: ${zip.stderr?.toString()}`);
  return { baseDir, zipName };
}

function main(){
  const res = {};
  for (const l of Object.keys(tests)){
    res[l] = buildFor(l);
  }
  console.log('Cross-validation artifacts created under tools/crossval');
  for (const [k,v] of Object.entries(res)){
    console.log(`- Test ${k}: ${v.zipName}`);
  }
}

main();
