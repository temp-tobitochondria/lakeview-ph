<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OtpMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $email,
        public string $code,
        public string $purpose, // 'register' | 'reset'
        public int $ttlMinutes
    ) {}

    public function build() {
        // Try to personalize with first name if user exists (mainly for password reset)
        $firstName = 'there';
        try {
            $fullName = \App\Models\User::where('email', $this->email)->value('name');
            if ($fullName) {
                $parts = preg_split('/\s+/', trim($fullName));
                if ($parts && strlen($parts[0])) $firstName = $parts[0];
            }
        } catch (\Throwable $e) {}

        $subject = "🔐 Your LakeView PH Verification Code";

        return $this->subject($subject)
            ->view('mail.otp', [
                'name' => $firstName,
                'code' => $this->code,
                'purpose' => $this->purpose === 'reset' ? 'password reset' : 'verification',
                'ttlMinutes' => $this->ttlMinutes,
                'title' => 'Email OTP'
            ])
            ->text('mail.plain', [ // Plain fallback
                'content' => "Hi {$firstName},\n\nYour code: {$this->code}\nExpires in {$this->ttlMinutes} minutes."
            ]);
    }
}
