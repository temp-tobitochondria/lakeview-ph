// Shared helpers for stats test runners (A, B, C)

export function nfmt(x, digits = 6) {
  if (x === null || x === undefined) return String(x);
  if (typeof x === 'number') return Number.isFinite(x) ? x.toFixed(digits) : String(x);
  return String(x);
}

// p-value formatter per requirements:
// - if p < 0.001 => "<0.001 (p=<full decimal>; <E notation>)"
// - otherwise fixed decimals
export function pfmt(p) {
  if (p === null || p === undefined) return String(p);
  if (!Number.isFinite(p)) return String(p);
  if (p < 0.001) {
    const full = p.toPrecision(12); // full numeric in decimal
    const enote = p.toExponential(2); // scientific
    return `<0.001 (p=${full}; ${enote})`;
  }
  if (p > 0.999) return `>0.999 (p=${p.toFixed(6)})`;
  return p.toFixed(6);
}

export function bulletLine(label, obj, { pKeys = ['p', 'p_value', 'p_lower', 'p_upper', 'p_max'] } = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const isP = pKeys.includes(k) || k.toLowerCase().startsWith('p');
    parts.push(`${k}=${typeof v === 'number' && isP ? pfmt(v) : nfmt(v)}`);
  }
  return `- ${label}: ${parts.join(', ')}`;
}

export function section(title) {
  return `- Section: ${title}`;
}

export function print(lines = []) {
  for (const l of lines) console.log(l);
}

