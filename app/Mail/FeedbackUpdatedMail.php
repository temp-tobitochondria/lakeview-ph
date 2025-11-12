<?php

namespace App\Mail;

use App\Models\Feedback;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class FeedbackUpdatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Feedback $feedback,
        public ?string $newStatus,
        public ?string $reply
    ) {}

    public function build(): self
    {
    $appName = 'LakeView PH';
    $title = 'Feedback Update';
    $subject = "\xF0\x9F\x8C\x8A $appName — Your Feedback Update"; // 🌊 wave emoji

        $lines = [];
        $displayTitle = $this->feedback->title ?: 'Untitled';
        $lines[] = "We’ve reviewed your feedback titled \"{$displayTitle}\", and here’s the latest update:";
        if ($this->newStatus) {
            $lines[] = 'Status: '.ucwords(str_replace('_',' ', $this->newStatus));
        }
        if ($this->reply && trim($this->reply) !== '') {
            $lines[] = 'Reviewer’s Message:';
            $lines[] = $this->reply;
        }

        return $this
            ->subject($subject)
            ->view('mail.message', [
                'title' => $title,
                'name' => optional($this->feedback->user)->name,
                'lines' => $lines,
                'signoff' => "Thank you for taking the time to share your feedback — it helps us improve $appName for everyone.\n\nWishing you clear skies and calm waters,\n— $appName",
            ])
            ->text('mail.plain', [
                'title' => $title,
                'content' => implode("\n\n", $lines)."\n\nThank you for taking the time to share your feedback — it helps us improve $appName for everyone.\n\nWishing you clear skies and calm waters,\n— $appName",
            ]);
    }
}
