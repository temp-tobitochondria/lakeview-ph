<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class MailSamplesCommandTest extends TestCase
{
    public function test_mail_samples_command_runs_successfully(): void
    {
        $exitCode = Artisan::call('mail:samples', ['email' => 'gac.palc@gmail.com']);
        $this->assertSame(0, $exitCode, 'mail:samples should exit successfully');
    }
}
