<?php

namespace App\Http\Controllers;

use App\Models\Lake;
use App\Models\Parameter;
use App\Models\SampleResult;
use App\Models\SamplingEvent;
use App\Services\WaterQualityEvaluator;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PollutionController extends Controller
{
    protected WaterQualityEvaluator $evaluator;

    public function __construct(WaterQualityEvaluator $evaluator)
    {
        $this->evaluator = $evaluator;
    }

    /**
     * GET /api/pollution/points
     * Build per-station pollution severity points for a lake.
     * Query params:
     * - lake_id (int, required)
     * - parameter (string|int, optional) => 'overall' (default) or parameter id
     * - sampled_from (date ISO, optional)
     * - sampled_to (date ISO, optional)
     * - agg (string, optional) => latest|avg|max (default: latest)
     * - bbox (string, optional) => minLon,minLat,maxLon,maxLat (limits geom_point)
     * - max_points (int, optional) => cap number of stations returned (sampling)
     *
     * Response shape:
     * { points: [ [lat, lon, weight], ... ], meta: { count, p95_raw, parameter, agg, window } }
     */
    public function points(Request $request)
    {
        $validated = $request->validate([
            'lake_id'      => 'required|integer|min:1',
            'parameter'    => 'nullable', // 'overall' | int id
            'sampled_from' => 'nullable|date',
            'sampled_to'   => 'nullable|date',
            'agg'          => 'nullable|string|in:latest,avg,max',
            'bbox'         => 'nullable|string',
            'max_points'   => 'nullable|integer|min:50|max:10000',
        ]);

        $lakeId = (int) $validated['lake_id'];
        $paramFilter = $validated['parameter'] ?? 'overall';
        $agg = $validated['agg'] ?? 'latest';
        $bbox = $validated['bbox'] ?? null;
        $maxPoints = isset($validated['max_points']) ? (int)$validated['max_points'] : 5000;

        // Validate lake existence (and get class for threshold lookup via evaluator)
        $lake = Lake::select('id', 'name', 'class_code')->find($lakeId);
        if (!$lake) {
            abort(422, 'Invalid lake_id');
        }

        // Normalize parameter selection
        $parameterId = null;
        $parameterMeta = 'overall';
        if ($paramFilter !== null && $paramFilter !== '' && $paramFilter !== 'overall') {
            // accept numeric string
            $pid = (int) $paramFilter;
            $param = Parameter::select('id', 'code', 'name', 'evaluation_type')->find($pid);
            if (!$param) {
                abort(422, 'Invalid parameter');
            }
            $parameterId = $param->id;
            $parameterMeta = [
                'id' => $param->id,
                'code' => $param->code,
                'name' => $param->name,
                'evaluation_type' => $param->evaluation_type,
            ];
        }

        // Base query: public events for lake with point geometry
        $events = SamplingEvent::query()
            ->select('sampling_events.id', 'sampling_events.sampled_at', 'sampling_events.station_id', 'sampling_events.applied_standard_id')
            ->selectRaw('ST_Y(geom_point) AS latitude')
            ->selectRaw('ST_X(geom_point) AS longitude')
            ->where('sampling_events.lake_id', $lakeId)
            ->where('sampling_events.status', 'public')
            ->whereNotNull('geom_point');

        if ($request->filled('sampled_from')) {
            $events->where('sampling_events.sampled_at', '>=', CarbonImmutable::parse($request->input('sampled_from')));
        }
        if ($request->filled('sampled_to')) {
            $events->where('sampling_events.sampled_at', '<=', CarbonImmutable::parse($request->input('sampled_to')));
        }

        if ($bbox) {
            $parts = array_map('trim', explode(',', $bbox));
            if (count($parts) === 4) {
                [$minLon, $minLat, $maxLon, $maxLat] = $parts;
                $events->whereRaw('ST_Intersects(geom_point, ST_MakeEnvelope(?, ?, ?, ?, 4326))', [
                    (float)$minLon, (float)$minLat, (float)$maxLon, (float)$maxLat
                ]);
            }
        }

        // Eager-load only needed results
        $events->with(['results' => function ($q) use ($parameterId) {
            $q->select('id', 'sampling_event_id', 'parameter_id', 'value')
              ->when($parameterId !== null, fn($qq) => $qq->where('parameter_id', $parameterId))
              ->with(['parameter:id,code,name,unit,evaluation_type']);
        }, 'appliedStandard:id,code', 'lake:id,class_code']);

        $rows = $events
            ->orderByDesc('sampling_events.sampled_at')
            ->limit($maxPoints * 3) // allow oversampling; we will aggregate to stations below
            ->get();

        if ($rows->isEmpty()) {
            return response()->json(['points' => [], 'meta' => [
                'count' => 0,
                'parameter' => $parameterMeta,
                'agg' => $agg,
            ]]);
        }

        // Compute raw severities per event-result and aggregate per station id
        $stationBuckets = [];
        $allRawSev = [];

        foreach ($rows as $event) {
            $lat = (float) $event->latitude; $lon = (float) $event->longitude;
            if (!is_finite($lat) || !is_finite($lon)) continue;

            $event->setRelation('lake', $lake); // ensure evaluator sees lake->class_code
            $event->setRelation('appliedStandard', $event->appliedStandard); // explicit

            $sevValues = [];
            foreach ($event->results as $res) {
                if ($res->value === null) continue;
                // Evaluate once (no save) to resolve threshold according to standard and class
                try {
                    $this->evaluator->evaluate($res, false);
                } catch (\Throwable $e) {
                    // Continue without threshold
                }
                $threshold = $res->threshold; // may be null
                $param = $res->parameter;
                $evalType = $this->normalizeEvalType($param?->evaluation_type);
                if (!$threshold || !$evalType) continue;
                $sev = $this->severity($evalType, (float)$res->value, $threshold->min_value, $threshold->max_value);
                if ($sev !== null) {
                    $sevValues[] = $sev;
                    $allRawSev[] = $sev;
                }
            }

            if (empty($sevValues)) continue;

            // If parameter=overall: take max severity across parameters for this event
            // If parameter is specific: sevValues already contains only that parameter (if multiple entries exist, keep max)
            $eventSev = max($sevValues);

            $sid = $event->station_id ?: ('evt-' . $event->id);
            if (!isset($stationBuckets[$sid])) {
                $stationBuckets[$sid] = [
                    'lat' => $lat,
                    'lon' => $lon,
                    'values' => [],
                    'latest_at' => $event->sampled_at,
                ];
            }
            $stationBuckets[$sid]['values'][] = ['sev' => $eventSev, 'at' => $event->sampled_at];
            // track latest timestamp for 'latest' agg tie-break
            if ($stationBuckets[$sid]['latest_at'] === null || ($event->sampled_at && $event->sampled_at > $stationBuckets[$sid]['latest_at'])) {
                $stationBuckets[$sid]['latest_at'] = $event->sampled_at;
            }
        }

        if (empty($stationBuckets)) {
            return response()->json(['points' => [], 'meta' => [
                'count' => 0,
                'parameter' => $parameterMeta,
                'agg' => $agg,
            ]]);
        }

        // Robust cap using p95 across all raw severities, then sqrt compression
        $p95 = $this->p95($allRawSev);
        $cap = $p95 > 0 ? $p95 : 1.0;
        $compress = function ($x) use ($cap) {
            $r = $x / $cap; if ($r < 0) $r = 0; if ($r > 1) $r = 1; return sqrt($r);
        };

        $pts = [];
        foreach ($stationBuckets as $sid => $bucket) {
            $vals = $bucket['values'];
            if (empty($vals)) continue;
            $w = null;
            if ($agg === 'latest') {
                // Find the most recent value
                usort($vals, fn($a,$b) => ($a['at'] <=> $b['at']));
                $last = end($vals);
                $w = $compress($last['sev']);
            } elseif ($agg === 'avg') {
                $sum = 0; $n = 0; foreach ($vals as $v) { $sum += $v['sev']; $n++; }
                $w = $compress($n > 0 ? $sum / $n : 0);
            } else { // max
                $max = 0; foreach ($vals as $v) { if ($v['sev'] > $max) $max = $v['sev']; }
                $w = $compress($max);
            }
            if ($w !== null) {
                $pts[] = [ (float)$bucket['lat'], (float)$bucket['lon'], (float)$w ];
            }
        }

        // Optionally sample to max_points if too many (random sample)
        if (count($pts) > $maxPoints) {
            shuffle($pts);
            $pts = array_slice($pts, 0, $maxPoints);
        }

        return response()->json([
            'points' => $pts,
            'meta' => [
                'count' => count($pts),
                'p95_raw' => $p95,
                'parameter' => $parameterMeta,
                'agg' => $agg,
                'window' => [
                    'from' => $request->input('sampled_from'),
                    'to'   => $request->input('sampled_to'),
                ],
            ],
        ]);
    }

    private function normalizeEvalType(?string $raw): ?string
    {
        if ($raw === null) return null;
        $s = strtolower(trim((string)$raw));
        $symbolMap = ['<' => 'max', '<=' => 'max', '>' => 'min', '>=' => 'min'];
        if (isset($symbolMap[$s])) return $symbolMap[$s];
        $key = preg_replace('/[^a-z0-9]/', '', $s);
        $upper = ['max','maximum','upper','upperlimit','lessthan','lessthanorequal','lt','lte','below','under'];
        $lower = ['min','minimum','lower','lowerlimit','greaterthan','greaterthanorequal','gt','gte','above','over'];
        $range = ['range','between'];
        if (in_array($key, $upper, true) || in_array($s, $upper, true)) return 'max';
        if (in_array($key, $lower, true) || in_array($s, $lower, true)) return 'min';
        if (in_array($key, $range, true) || in_array($s, $range, true)) return 'range';
        if (in_array($s, ['min','max','range'], true)) return $s;
        return null;
    }

    /**
     * Compute raw severity (unbounded) based on evaluation type and threshold.
     * - max: 0 when value <= max; else (value-max)/max
     * - min: 0 when value >= min; else (min-value)/min
     * - range: 0 within [min,max]; else distance to nearest bound divided by range (or bound when range=0)
     */
    private function severity(string $evalType, float $value, ?float $min, ?float $max): ?float
    {
        switch ($evalType) {
            case 'max':
                if ($max === null) return null;
                if ($value <= $max) return 0.0;
                $den = ($max != 0.0) ? abs($max) : 1.0;
                return max(0.0, ($value - $max) / $den);
            case 'min':
                if ($min === null) return null;
                if ($value >= $min) return 0.0;
                $den = ($min != 0.0) ? abs($min) : 1.0;
                return max(0.0, ($min - $value) / $den);
            case 'range':
                if ($min === null || $max === null) return null;
                if ($value >= $min && $value <= $max) return 0.0;
                $range = $max - $min;
                if ($range > 0) {
                    if ($value < $min) return ($min - $value) / $range;
                    else return ($value - $max) / $range;
                }
                // degenerate range; fall back to distance to bound over abs(bound) or 1
                if ($value < $min) {
                    $den = ($min != 0.0) ? abs($min) : 1.0;
                    return ($min - $value) / $den;
                } else {
                    $den = ($max != 0.0) ? abs($max) : 1.0;
                    return ($value - $max) / $den;
                }
            default:
                return null;
        }
    }

    /** Approximate 95th percentile */
    private function p95(array $values): float
    {
        $vals = array_values(array_filter($values, fn($v) => is_finite($v) && $v >= 0));
        $n = count($vals);
        if ($n === 0) return 1.0;
        sort($vals);
        $idx = (int) floor(0.95 * ($n - 1));
        return (float) ($vals[$idx] ?? $vals[$n - 1] ?? 1.0);
    }
}
