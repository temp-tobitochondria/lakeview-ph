import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { yearLabelPlugin } from './shared';

// Ensure required elements/plugins are available when rendering offscreen
try { ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend); } catch {}
try { ChartJS.register(yearLabelPlugin); } catch {}

function deepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj ?? {})); } catch { return {}; }
}

function buildLightOptions(srcOpts = {}) {
  const clone = deepClone(srcOpts);

  const set = (obj, path, val) => {
    const segs = path.split('.');
    let cur = obj;
    for (let i = 0; i < segs.length - 1; i++) {
      const k = segs[i];
      if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[segs[segs.length - 1]] = val;
  };

  // Legend / titles
  set(clone, 'plugins.legend.labels.color', '#111');
  if (clone?.plugins?.title) set(clone, 'plugins.title.color', '#111');
  if (clone?.plugins?.yearLabelPlugin) set(clone, 'plugins.yearLabelPlugin.color', '#111');

  // Scales
  clone.scales = clone.scales || {};
  const scaleKeys = Object.keys(clone.scales).length ? Object.keys(clone.scales) : ['x', 'y'];
  scaleKeys.forEach((k) => {
    const s = clone.scales[k] || (clone.scales[k] = {});
    s.ticks = { ...(s.ticks || {}), color: '#111' };
    s.grid = { ...(s.grid || {}), color: '#e5e7eb' }; // gray-200
    if (s.title) s.title = { ...(s.title || {}), color: '#111' };
  });

  // Export should not rely on layout changes
  clone.responsive = false;
  clone.maintainAspectRatio = false;
  clone.animation = false;
  return clone;
}

// Returns a data URL for the chart image. Uses offscreen canvas with a white background.
export function exportChartToDataUrl(inst, { format = 'image/png', scale = 1, background = '#ffffff' } = {}) {
  if (!inst) return '';
  try {
    // Compute canvas dimensions using rendered size and DPR
    const srcCanvas = inst.canvas;
    const dpr = inst.currentDevicePixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const cssW = inst.width || (srcCanvas ? srcCanvas.clientWidth : 0) || 1000;
    const cssH = inst.height || (srcCanvas ? srcCanvas.clientHeight : 0) || 600;
    const pxW = Math.max(1, Math.round(cssW * dpr * (scale || 1)));
    const pxH = Math.max(1, Math.round(cssH * dpr * (scale || 1)));

  const off = document.createElement('canvas');
  off.width = pxW;
  off.height = pxH;

    const data = deepClone(inst.config?.data || inst.data || {});
    const type = inst.config?.type || 'line';
    const lightOptions = buildLightOptions(inst.options || {});

    // Simplify legends for exported bar charts to avoid clutter:
    // - Show only threshold lines (dataset.type === 'line') in legend
    // - If no line datasets exist, hide legend entirely
    try {
      if (String(type).toLowerCase() === 'bar') {
        const dsets = Array.isArray(data?.datasets) ? data.datasets : [];
        const hasLine = dsets.some((ds) => ds && ds.type === 'line');
        lightOptions.plugins = lightOptions.plugins || {};
        lightOptions.plugins.legend = lightOptions.plugins.legend || {};
        if (hasLine) {
          lightOptions.plugins.legend.display = true;
          const prevLabels = lightOptions.plugins.legend.labels || {};
          lightOptions.plugins.legend.labels = {
            ...prevLabels,
            // keep labels in dark for export; filter to only line datasets
            filter: (legendItem, chartData) => {
              try {
                const ds = chartData?.datasets?.[legendItem.datasetIndex];
                return !!(ds && ds.type === 'line');
              } catch {
                return false;
              }
            },
          };
        } else {
          lightOptions.plugins.legend.display = false;
        }
      }
    } catch {}

    // Background painter
    const bgWhitePlugin = {
      id: 'bgWhiteExport',
      beforeDraw: (chart) => {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.fillStyle = background || '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },
    };

    const tmp = new ChartJS(off.getContext('2d'), {
      type,
      data,
      options: lightOptions,
      plugins: [bgWhitePlugin],
    });
    tmp.update('none');
    const url = off.toDataURL(format);
    tmp.destroy();
    return url;
  } catch (e) {
    try {
      return inst.toBase64Image ? inst.toBase64Image() : inst.canvas?.toDataURL('image/png');
    } catch {
      return '';
    }
  }
}

export function downloadDataUrl(url, filename = 'chart.png') {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportAndDownload(inst, filename, opts = {}) {
  let url = exportChartToDataUrl(inst, opts);
  // Fallback in case of unusual blank/short data URLs
  if (!url || url.length < 2000) {
    try { url = inst.toBase64Image ? inst.toBase64Image() : inst.canvas?.toDataURL('image/png'); } catch {}
  }
  downloadDataUrl(url, filename);
}

export default {
  exportChartToDataUrl,
  downloadDataUrl,
  exportAndDownload,
};
