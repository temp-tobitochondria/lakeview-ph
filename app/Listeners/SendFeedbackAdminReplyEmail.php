<?php

namespace App\Listeners;

use App\Events\FeedbackAdminReplied;
use App\Mail\FeedbackAdminReplyMail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendFeedbackAdminReplyEmail implements ShouldQueue
{
    use InteractsWithQueue;

    public $tries = 3;
    public $backoff = [10, 30, 60];

    public function handle(FeedbackAdminReplied $event): void
    {
        if (!config('feedback.emails_enabled', true)) {
            return;
        }

        $fb = $event->feedback->fresh(['user']);

        $to = $fb->is_guest ? ($fb->guest_email ?: null) : ($fb->user?->email ?: null);
        if ($fb->is_guest || empty($to)) {
            return;
        }

        // Don't send empty replies
        if (!($event->newReply && trim((string)$event->newReply) !== '')) {
            return;
        }

        try {
            Mail::to($to)->queue(new FeedbackAdminReplyMail($fb, $event->newReply));
        } catch (\Throwable $e) {
            Log::warning('Failed to queue FeedbackAdminReplyMail: '.$e->getMessage(), ['feedback_id' => $fb->id]);
        }
    }
}
