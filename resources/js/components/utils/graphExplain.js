export function buildGraphExplanation(ctx) {
  const {
  chartType = 'time', // 'time' | 'depth' | 'correlation'
    param = {},         // { code, name, unit }
    seriesMode = 'avg', // 'avg' | 'per-station'
    bucket = 'month',   // 'month' | 'quarter' | 'year'
    standards = [],     // [{ code, min, max }...] or with buckets info
    compareMode = false,
    lakeLabels = {},    // { a, b }
    inferredType = null // 'min' | 'max' | 'range'
  } = ctx || {};

  const title = `${param?.name || param?.code || 'Selected parameter'}${param?.unit ? ` (${param.unit})` : ''}`;

  const sections = [];
  // Short note: single lake vs compare mode
  if (compareMode) {
    sections.push({
      heading: 'Comparing two lakes',
      text: `You are comparing ${lakeLabels?.a || 'Lake A'} and ${lakeLabels?.b || 'Lake B'}. Each lake is shown with its own color so you can see differences side by side.`
    });
  } else {
    sections.push({
      heading: 'Single lake view',
      text: 'This view shows data for one lake or a single selection. Lines and bars represent that lake only.'
    });
  }

  // Chart-specific explanations in plain English
  if (chartType === 'depth') {
    sections.push({
      heading: 'Depth profile (what it shows)',
      bullets: [
        'Horizontal axis = the measured value of the parameter (for example, turbidity or temperature).',
        'Vertical axis = depth in meters. Depth increases downward (top is surface).',
        'Each line is a group (for example a month or year) showing how the value changes with depth.'
      ]
    });

    // Thresholds only apply to depth, bar, and time-series
    if (Array.isArray(standards) && standards.length) {
      const stdLabels = standards.map(s => s.code).filter(Boolean).join(', ') || 'the standard';
      sections.push({
        heading: 'Thresholds on the depth chart',
        text: `Where the standard applies, you may see lines showing minimums and maximums (${stdLabels}). These show the acceptable range.`
      });
    } else {
      sections.push({ heading: 'Thresholds on the depth chart', text: 'No threshold lines apply for this selection.' });
    }

    // Interpretation
    const hasAnyMin = standards.some(s => s.min != null);
    const hasAnyMax = standards.some(s => s.max != null);
    const type = inferredType || (hasAnyMin && hasAnyMax ? 'range' : hasAnyMin ? 'min' : hasAnyMax ? 'max' : null);
    let hint = null;
    if (type === 'min') hint = 'Higher is better. Values below the minimum may be a problem.';
    if (type === 'max') hint = 'Lower is better. Values above the maximum may be a problem.';
    if (type === 'range') hint = 'Best inside the range between the minimum and maximum. Outside that range indicates exceedance.';
    if (hint) sections.push({ heading: 'How to read a depth profile', text: hint });

  } else if (chartType === 'correlation') {
    sections.push({
      heading: 'Correlation plot (what it shows)',
      bullets: [
        'This is a scatter plot that pairs two different parameters measured at the same time and place.',
        'Each point is one paired measurement (for example, pH vs dissolved oxygen).',
        'The trend line (R²) tells how well the line fits the points (closer to 1 = better fit).'
      ]
    });

    // Simple, exclusive interpretation guidance for correlation
    sections.push({
      heading: 'How to interpret correlation',
      bullets: [
        'If points lie close to a straight line and R² is high, the two parameters change together.',
        'If the line slopes up, when X increases Y also increases. If it slopes down, when X increases Y decreases.',
        "If points are scattered with no clear line, there is little or no linear relationship.",
        "Correlation is not the same as cause — two things can move together for other reasons."
      ]
    });

  } else if (chartType === 'bar') {
    sections.push({
      heading: 'Bar chart (what it shows)',
      bullets: [
        seriesMode === 'per-station'
          ? 'Each bar represents a station (or category). Heights are the average or count for that station.'
          : 'Each bar represents the aggregated value across selected stations for the bucket shown.',
        compareMode ? 'In compare mode, bars for each lake appear side by side so you can compare them.' : 'In single-lake mode bars show values for the chosen lake.'
      ]
    });

    if (Array.isArray(standards) && standards.length) {
      const stdLabels = standards.map(s => s.code).filter(Boolean).join(', ') || 'the standard';
      sections.push({ heading: 'Thresholds on the bar chart', text: `Threshold lines or colored bands (${stdLabels}) show acceptable ranges. Compare bar heights to these lines.` });
    } else {
      sections.push({ heading: 'Thresholds on the bar chart', text: 'No thresholds found for this selection.' });
    }

    // Interpretation
    const hasMinBar = standards.some(s => s.min != null);
    const hasMaxBar = standards.some(s => s.max != null);
    const typeBar = inferredType || (hasMinBar && hasMaxBar ? 'range' : hasMinBar ? 'min' : hasMaxBar ? 'max' : null);
    let hintBar = null;
    if (typeBar === 'min') hintBar = 'Higher is better. Bars below the minimum may indicate poor conditions.';
    if (typeBar === 'max') hintBar = 'Lower is better. Bars above the maximum may indicate exceedance.';
    if (typeBar === 'range') hintBar = 'Best when bars fall inside the acceptable range.';
    if (hintBar) sections.push({ heading: 'How to read a bar chart', text: hintBar });

  } else { // default/time-series
    sections.push({
      heading: 'Time-series (what it shows)',
      bullets: [
        `This chart shows how ${param?.name || 'the parameter'} changes over time by ${bucket}.`,
        seriesMode === 'per-station'
          ? 'Each line is a station; points are averages for that station in each time bucket.'
          : 'The line is the average across stations for each time bucket.'
      ]
    });

    if (Array.isArray(standards) && standards.length) {
      const stdLabels = standards.map(s => s.code).filter(Boolean).join(', ') || 'the standard';
      sections.push({ heading: 'Thresholds on the time chart', text: `Where relevant, you will see minimum and maximum threshold lines (${stdLabels}). They only appear where the standard applies.` });
    } else {
      sections.push({ heading: 'Thresholds on the time chart', text: 'No thresholds found for this period or selection.' });
    }

    // Interpretation
    const hasAnyMinTime = standards.some(s => s.min != null);
    const hasAnyMaxTime = standards.some(s => s.max != null);
    const typeTime = inferredType || (hasAnyMinTime && hasAnyMaxTime ? 'range' : hasAnyMinTime ? 'min' : hasAnyMaxTime ? 'max' : null);
    let hintTime = null;
    if (typeTime === 'min') hintTime = 'Higher is better. Values below the minimum are of concern.';
    if (typeTime === 'max') hintTime = 'Lower is better. Values above the maximum are of concern.';
    if (typeTime === 'range') hintTime = 'Best when values are inside the acceptable range; outside means exceedance.';
    if (hintTime) sections.push({ heading: 'How to read a time-series', text: hintTime });
  }

  return { title, sections };
}
