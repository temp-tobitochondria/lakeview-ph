<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use App\Mail\OtpMail;
use App\Mail\OrgApplicationSubmitted;
use App\Mail\OrgApplicationDecision;
use App\Mail\FeedbackUpdatedMail;
use App\Models\User;
use App\Models\Tenant;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Send sample emails to a single address for review
Artisan::command('mail:samples {email=gac.palc@gmail.com}', function (string $email) {
    $this->info("Routing all sample emails to: {$email}");
    Mail::alwaysTo($email);

    // Create in-memory model instances without touching the database
    $user = new User();
    $user->name = 'Sample User';
    $user->email = $email;
    $tenant = new Tenant();
    $tenant->name = 'Sample Tenant';

    Mail::sendNow(new OtpMail($email, '123456', 'register', 15));
    $this->line('Sent: OtpMail');

    Mail::sendNow(new OrgApplicationSubmitted($user, $tenant, 'pending_review'));
    $this->line('Sent: OrgApplicationSubmitted');

    Mail::sendNow(new OrgApplicationDecision($user, 'approved', 'Looks great!', $tenant->name));
    $this->line('Sent: OrgApplicationDecision');

    // Feedback updated sample
    $feedback = new \App\Models\Feedback();
    $feedback->title = 'Sample Feedback Title';
    $feedback->user = $user;
    Mail::sendNow(new FeedbackUpdatedMail($feedback, 'in_progress', 'Thanks for reporting this. We are on it.'));
    $this->line('Sent: FeedbackUpdatedMail');

    $this->info('Done. Check your configured mail transport (e.g. log, smtp).');
})->purpose('Send sample instances of system emails to a single address for review');
