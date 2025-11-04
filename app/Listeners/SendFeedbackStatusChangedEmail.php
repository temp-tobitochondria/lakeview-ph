<?php

namespace App\Listeners;

use App\Events\FeedbackStatusChanged;
use App\Mail\FeedbackStatusChangedMail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendFeedbackStatusChangedEmail implements ShouldQueue
{
    use InteractsWithQueue;

    public $tries = 3;
    public $backoff = [10, 30, 60];

    public function handle(FeedbackStatusChanged $event): void
    {
        if (!config('feedback.emails_enabled', true)) {
            return;
        }

        $fb = $event->feedback->fresh(['user']);

        // Skip guests or when no recipient email
        $to = $fb->is_guest ? ($fb->guest_email ?: null) : ($fb->user?->email ?: null);
        if ($fb->is_guest || empty($to)) {
            return;
        }

        try {
            Mail::to($to)->queue(new FeedbackStatusChangedMail($fb, $event->oldStatus, $event->newStatus));
        } catch (\Throwable $e) {
            Log::warning('Failed to queue FeedbackStatusChangedMail: '.$e->getMessage(), ['feedback_id' => $fb->id]);
        }
    }
}
