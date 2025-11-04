<?php

namespace App\Mail;

use App\Models\Feedback;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class FeedbackAdminReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Feedback $feedback,
        public string $reply,
    ) {}

    public function build()
    {
        return $this->subject('New reply to your feedback')
            ->markdown('emails.feedback.admin_reply', [
                'feedback' => $this->feedback,
                'reply' => $this->reply,
            ]);
    }
}
