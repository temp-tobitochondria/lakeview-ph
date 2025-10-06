<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class KycDecision extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $status, public ?string $notes = null) {}

    public function build()
    {
        $msg = $this->status === 'verified'
            ? "Your KYC has been approved."
            : "Your KYC has been rejected.";
        if ($this->notes) $msg .= "\n\nNotes: {$this->notes}";
        return $this->subject('LakeView PH: KYC review result')
            ->text('mail.plain', [
                'content' => "Hi,\n\n{$msg}\n\n— LakeView PH",
            ]);
    }
}
