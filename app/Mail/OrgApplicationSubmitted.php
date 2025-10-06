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
        $line = $this->initialStatus === 'pending_kyc'
            ? "We received your application. It will move forward once your KYC is verified."
            : "Your application is now pending organization review.";
        return $this->subject('LakeView PH: Organization application submitted')
            ->text('mail.plain', [
                'content' => "Hi,\n\n{$line}\n\n— LakeView PH",
            ]);
    }
}
