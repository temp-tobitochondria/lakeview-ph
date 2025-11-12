<?php

namespace Tests\Feature;

use App\Mail\OtpMail;
use Tests\TestCase;

class MailHtmlTemplateTest extends TestCase
{
    public function test_otp_mail_html_contains_otp_box_and_footer(): void
    {
        $mail = new OtpMail('user@example.com', '654321', 'register', 10);
        $html = $mail->render();
        $this->assertStringContainsString('class="otp-box"', $html);
        $this->assertStringContainsString('system-generated email', $html);
        $this->assertStringContainsString('654321', $html);
    }
}
