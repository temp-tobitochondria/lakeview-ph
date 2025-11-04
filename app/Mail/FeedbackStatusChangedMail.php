<?php

namespace App\Mail;

use App\Models\Feedback;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class FeedbackStatusChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Feedback $feedback,
        public string $oldStatus,
        public string $newStatus,
    ) {}

    public function build()
    {
        return $this->subject('Your feedback status was updated')
            ->markdown('emails.feedback.status_changed', [
                'feedback' => $this->feedback,
                'oldStatus' => $this->oldStatus,
                'newStatus' => $this->newStatus,
            ]);
    }
}
