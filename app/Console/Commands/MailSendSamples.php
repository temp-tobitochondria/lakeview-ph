<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use App\Mail\OtpMail;
use App\Mail\OrgApplicationSubmitted;
use App\Mail\OrgApplicationDecision;
use App\Models\User;
use App\Models\Tenant;

class MailSendSamples extends Command
{
    protected $signature = 'mail:samples {email=gac.palc@gmail.com : Target email address to receive all sample mails}';
    protected $description = 'Send sample instances of system emails to a single address for review.';

    public function handle(): int
    {
        $to = $this->argument('email');
        $this->info("Routing all sample emails to: {$to}");

        // Force all mail to the given address for this run only.
        Mail::alwaysTo($to);

        // Build lightweight fake model instances (not persisted) as needed.
        $user = new User(['name' => 'Sample User', 'email' => $to]);
        $tenant = new Tenant(['name' => 'Sample Tenant']);

        $sent = 0;

        // OTP mail (registration purpose example)
        Mail::send(new OtpMail($to, '123456', 'register', 15));
        $this->line('Sent: OtpMail');
        $sent++;

        // Org application submitted
        Mail::send(new OrgApplicationSubmitted($user, $tenant, 'pending_review'));
        $this->line('Sent: OrgApplicationSubmitted');
        $sent++;

        // Org application decision (approved sample)
        Mail::send(new OrgApplicationDecision($user, 'approved', 'Looks great!', $tenant->name));
        $this->line('Sent: OrgApplicationDecision');
        $sent++;

        $this->info("Finished sending {$sent} sample emails to {$to} (check configured transport e.g. log).");
        return Command::SUCCESS;
    }
}
