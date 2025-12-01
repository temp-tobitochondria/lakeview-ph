<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Illuminate\Http\Request;

class FeedbackStreamController extends Controller
{
    // Simple Server-Sent Events (SSE) stream for new feedback rows.
    // Query param: last_id (int) - highest feedback id the client already has.
    // Keeps connection open ~45s, emitting events when new rows appear; client should reconnect.
    public function stream(Request $request)
    {
        $lastId = (int) $request->query('last_id', 0);
        $started = microtime(true);
        $timeoutSeconds = 45; // connection lifespan
        return response()->stream(function () use (&$lastId, $started, $timeoutSeconds) {
            // Disable compression / buffering to allow streaming
            if (function_exists('apache_setenv')) {
                @apache_setenv('no-gzip', '1');
            }
            @ini_set('zlib.output_compression', '0');
            @ini_set('output_buffering', 'off');
            @ini_set('implicit_flush', '1');
            @ob_implicit_flush(true);
            // Initial handshake comment
            echo ": feedback stream started\n\n";
            @ob_flush(); @flush();
            while ((microtime(true) - $started) < $timeoutSeconds) {
                // Fetch any new feedback rows since lastId
                $rows = Feedback::query()
                    ->where('id', '>', $lastId)
                    ->orderBy('id')
                    ->limit(50)
                    ->get(['id']);
                if ($rows->count()) {
                    foreach ($rows as $row) {
                        $lastId = $row->id;
                        echo "event: feedback-created\n";
                        echo 'data: ' . json_encode(['id' => $row->id]) . "\n\n";
                    }
                    @ob_flush(); @flush();
                }
                // Sleep briefly to avoid tight loop (500ms)
                usleep(500 * 1000);
            }
            echo ": feedback stream ended\n\n";
            @ob_flush(); @flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no', // for some proxies
        ]);
    }
}
