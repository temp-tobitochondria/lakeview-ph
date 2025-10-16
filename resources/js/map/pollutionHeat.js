import axios from 'axios';
import { createHeatLayer } from './leafletHeat';

// Fetch pollution points (already normalized 0..1 on server)
export async function fetchPollutionPoints({ lakeId, parameter = 'overall', from = null, to = null, agg = 'latest', bbox = null, maxPoints = 5000 }, opts = {}) {
  const params = { lake_id: lakeId, agg };
  if (parameter && parameter !== 'overall') params.parameter = parameter;
  else params.parameter = 'overall';
  if (from) params.sampled_from = from;
  if (to) params.sampled_to = to;
  if (bbox) params.bbox = bbox;
  if (maxPoints) params.max_points = maxPoints;
  const axiosOpts = {};
  if (opts && opts.signal) axiosOpts.signal = opts.signal;
  if (typeof opts?.onProgress === 'function') {
    axiosOpts.onDownloadProgress = (evt) => {
      try {
        const total = evt.total || 0;
        if (total > 0) opts.onProgress(Math.max(0, Math.min(1, evt.loaded / total)));
        else opts.onProgress(null);
      } catch {}
    };
  }
  const { data } = await axios.get('/api/pollution/points', { params, ...axiosOpts });
  const raw = Array.isArray(data?.points) ? data.points : [];
  // Server returns intensities already normalized [0,1]
  const normalized = raw;
  return { raw, normalized, meta: data?.meta || {} };
}

export function fetchPollutionPointsProgressive(params, callbacks = {}, opts = {}) {
  const { maxPoints = 5000 } = params;
  const smallPoints = Math.min(1200, Math.floor((maxPoints || 5000) / 4));
  const controller = new AbortController();
  const outerSignal = opts.signal;
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const run = (async () => {
    try {
      const small = await fetchPollutionPoints({ ...params, maxPoints: smallPoints }, { signal: controller.signal });
      callbacks.onIntermediate?.(small);
      if (controller.signal.aborted) return;
      if (smallPoints >= (params.maxPoints || 5000)) {
        callbacks.onFinal?.(small);
        return;
      }
      const full = await fetchPollutionPoints({ ...params }, { signal: controller.signal });
      if (!controller.signal.aborted) callbacks.onFinal?.(full);
    } catch (e) {
      if (!controller.signal.aborted) callbacks.onError?.(e);
    }
  })();
  return { abort: () => controller.abort(), promise: run };
}

export { createHeatLayer };
