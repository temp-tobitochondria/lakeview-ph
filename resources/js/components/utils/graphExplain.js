export function buildGraphExplanation(ctx) {
  const {
    chartType = 'time', // 'time' | 'depth' | 'bar'
    param = {},         // { code, name, unit, desc? }
    seriesMode = 'avg', // 'avg' | 'per-station'
    bucket = 'month',   // 'month' | 'quarter' | 'year'
    compareMode = false,
    lakeLabels = {},    // { a, b }

  } = ctx || {};

  const title = `${param?.name || param?.code || 'Selected parameter'}${param?.unit ? ` (${param.unit})` : ''}`;

  const sections = [];
  // 1) Parameter
  {
    const desc = (param && typeof param.desc === 'string') ? param.desc.trim() : '';
    sections.push({
      heading: 'Parameter',
      text: desc || 'No description available for this parameter.'
    });
  }

  // 2) Graph — chart-specific plain-English explanation
  if (chartType === 'depth') {
    sections.push({
      heading: 'Graph',
      bullets: [
        'Type: Depth profile.',
        'Horizontal axis: measured value of the parameter.',
        'Vertical axis: depth in meters (deeper values are lower on the chart).',
        'Each profile shows how the parameter changes with depth; profiles may be grouped by time (e.g., month, year).'
      ]
    });
  } else if (chartType === 'bar') {
    sections.push({
      heading: 'Graph',
      bullets: [
        'Type: Bar chart.',
        seriesMode === 'per-station'
          ? 'Each bar represents a station or category; height is the aggregated value for that station.'
          : 'Each bar represents the aggregated value across selected stations for each time bucket.',
        compareMode
          ? `Comparing lakes: bars for ${lakeLabels?.a || 'Lake A'} and ${lakeLabels?.b || 'Lake B'} appear side by side for direct comparison.`
          : 'Single lake: bars show values for the selected lake.'
      ]
    });
  } else {
    sections.push({
      heading: 'Graph',
      bullets: [
        'Type: Time-series.',
        `Horizontal axis: time by ${bucket}.`,
        `Vertical axis: ${param?.name || 'parameter'} value${param?.unit ? ` (${param.unit})` : ''}.`,
        seriesMode === 'per-station'
          ? 'Each line is a station; points are the station’s average in each time bucket.'
          : 'The line shows the average across selected stations for each time bucket.'
      ]
    });
  }

  return { title, sections };
}
