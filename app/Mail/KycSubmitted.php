<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class KycSubmitted extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public User $user) {}

    public function build()
    {
        return $this->subject('LakeView PH: KYC submitted')
            ->text('mail.plain', [
                'content' => "Hi,\n\nYour KYC has been submitted for review. We'll notify you once it's reviewed.\n\n— LakeView PH",
            ]);
    }
}
