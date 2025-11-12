<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
use App\Models\Tenant;

class OrgApplicationSubmitted extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public Tenant $tenant, public string $initialStatus) {}

    public function build()
    {
        $name = 'there';
        try {
            $full = (string) ($this->user->name ?? '');
            if (trim($full) !== '') {
                $parts = preg_split('/\s+/', trim($full));
                if ($parts && strlen($parts[0])) $name = $parts[0];
            }
        } catch (\Throwable $e) {}

    $subject = '✅ LakeView PH — Your Organization Application Has Been Received'; // static brand

        return $this->subject($subject)
            ->view('mail.message', [
                'title' => 'Application Received',
                'name' => $name,
                'lines' => [
                    "Thank you for submitting your organization application to {$this->tenant->name}.",
                    "We’ve successfully received your details and our team will review your submission shortly.",
                    "You can track your application’s status anytime in the “Join an Org” tab.",
                    "Once the review is complete, we’ll reach out with an update.",
                    "Until then, may your day stay smooth sailing.",
                ],
                'signoff' => '— LakeView PH',
            ])
            ->text('mail.plain', [
                'content' => "Good day {$name},\n\nThank you for submitting your organization application to {$this->tenant->name}. We’ve received your details and will review shortly. We’ll reach out with an update.\n\n— LakeView PH",
            ]);
    }
}
