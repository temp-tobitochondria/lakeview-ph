export function buildGraphExplanation(ctx) {
  const {
    chartType = 'time', // 'time' | 'depth' | 'spatial' | 'correlation'
    param = {},         // { code, name, unit }
    seriesMode = 'avg', // 'avg' | 'per-station'
    bucket = 'month',   // 'month' | 'quarter' | 'year'
    standards = [],     // [{ code, min, max }...] or with buckets info
    compareMode = false,
    lakeLabels = {},    // { a, b }
    summary = null,     // { n, mean, median }
    inferredType = null // 'min' | 'max' | 'range'
  } = ctx || {};

  const title = `${param?.name || param?.code || 'Selected parameter'}${param?.unit ? ` (${param.unit})` : ''}`;

  const sections = [];

  // What chart is this?
  if (chartType === 'depth') {
    sections.push({
      heading: 'What this chart shows',
      bullets: [
        'This is a depth profile: the horizontal axis is the parameter value; the vertical axis is depth in meters (increasing downward).',
        'Each colored line represents a group (month/quarter/year) over the selected time window, showing how values change with depth.',
        'Use this to see stratification or vertical gradients in the water column.'
      ]
    });
  } else if (chartType === 'spatial') {
    sections.push({
      heading: 'What this chart shows',
      bullets: [
        'This is a spatial trend across selected stations.',
        'The x‑axis lists stations in the order you selected them; the y‑axis shows the parameter value.',
        'Use this to compare locations at a snapshot (latest) or averaged within the selected range.'
      ]
    });
  } else if (chartType === 'correlation') {
    sections.push({
      heading: 'What this chart shows',
      bullets: [
        'This is a correlation scatter plot for a single station.',
        'Points pair Parameter X and Parameter Y measured in the same sampling event (typically at surface depth).',
        'An optional trend line uses simple least squares; R² indicates how well the line explains variance (closer to 1 is stronger).'
      ]
    });
  } else {
    sections.push({
      heading: 'What this chart shows',
      bullets: [
        `This is a time-series aggregated by ${bucket}.`,
        seriesMode === 'per-station'
          ? 'Each line represents a selected station; points are the average for that station within each time bucket.'
          : 'The line shows the average across selected stations within each time bucket.'
      ]
    });
  }

  // Summary info
  if (summary && typeof summary.n === 'number') {
    const parts = [`Samples: ${summary.n}`];
    if (Number.isFinite(summary.mean)) parts.push(`Mean: ${summary.mean.toFixed(2)}`);
    if (Number.isFinite(summary.median)) parts.push(`Median: ${summary.median.toFixed(2)}`);
    sections.push({ heading: 'Summary', text: parts.join(' · ') });
  }

  // Threshold explanation
  if (Array.isArray(standards) && standards.length) {
    const stdLabels = standards.map(s => s.code).filter(Boolean).join(', ');
    const bullets = [
      `Threshold lines are drawn per standard (${stdLabels}). Lines appear only over periods where the standard applies.`,
      'Min threshold lines are green; max threshold lines are red.'
    ];
    if (compareMode) bullets.push(`In compare mode, ${lakeLabels?.a || 'Lake A'} uses one green/red pair and ${lakeLabels?.b || 'Lake B'} uses a different green/red pair.`);
    sections.push({ heading: 'Standards and thresholds', bullets });
  } else {
    sections.push({ heading: 'Standards and thresholds', text: 'No threshold lines were found for this selection or period.' });
  }

  // How to interpret better vs worse
  let evalHint = null;
  const hasAnyMin = standards.some(s => s.min != null);
  const hasAnyMax = standards.some(s => s.max != null);
  const type = inferredType || (hasAnyMin && hasAnyMax ? 'range' : hasAnyMin ? 'min' : hasAnyMax ? 'max' : null);
  if (type === 'min') evalHint = 'Higher is better (values at or above the minimum threshold are desirable).';
  if (type === 'max') evalHint = 'Lower is better (values at or below the maximum threshold are desirable).';
  if (type === 'range') evalHint = 'Best within range (values are desirable inside the [min, max] band; outside indicates exceedance).';
  if (evalHint) sections.push({ heading: 'How to interpret values', text: evalHint });

  return { title, sections };
}
