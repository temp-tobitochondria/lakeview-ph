<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class OrgApplicationDecision extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $status, public ?string $notes = null) {}

    public function build()
    {
        $map = [
            'approved' => 'approved',
            'needs_changes' => 'sent back for changes',
            'rejected' => 'rejected',
        ];
        $state = $map[$this->status] ?? $this->status;
        $msg = "Your organization application was {$state}.";
        if ($this->notes) $msg .= "\n\nNotes: {$this->notes}";
        return $this->subject('LakeView PH: Organization application update')
            ->text('mail.plain', [
                'content' => "Hi,\n\n{$msg}\n\n— LakeView PH",
            ]);
    }
}
