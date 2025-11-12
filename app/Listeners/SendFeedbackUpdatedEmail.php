<?php

namespace App\Listeners;

use App\Events\FeedbackUpdated;
use App\Mail\FeedbackUpdatedMail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendFeedbackUpdatedEmail implements ShouldQueue
{
    use InteractsWithQueue;

    public $tries = 3;
    public $backoff = [10, 30, 60];
    protected static array $sentKeys = [];

    public function handle(FeedbackUpdated $event): void
    {
        if (!config('feedback.emails_enabled', true)) {
            return;
        }

        $fb = $event->feedback->fresh(['user']);

        // Only send to registered users for now (skip guests as per existing policy)
        $to = $fb->is_guest ? null : ($fb->user?->email ?: null);
        if (empty($to)) {
            return;
        }

        // If neither status nor reply actually changed, skip
        $hasAnyChange = ($event->newStatus !== null && $event->newStatus !== $event->oldStatus)
            || ($event->newReply !== null && $event->newReply !== $event->oldReply);
        if (!$hasAnyChange) {
            return;
        }

        // Dedupe within the same process/request to avoid double-queueing
        $key = $fb->id.'|'.($event->newStatus ?? '').'|'.md5((string) $event->newReply);
        if (isset(self::$sentKeys[$key])) {
            return;
        }
        self::$sentKeys[$key] = true;

        try {
            Mail::to($to)->queue(new FeedbackUpdatedMail($fb, $event->newStatus, $event->newReply));
        } catch (\Throwable $e) {
            Log::warning('Failed to queue FeedbackUpdatedMail: '.$e->getMessage(), ['feedback_id' => $fb->id]);
        }
    }
}
