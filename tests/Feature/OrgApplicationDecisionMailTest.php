<?php

namespace Tests\Feature;

use App\Mail\OrgApplicationDecision;
use App\Models\User;
use Tests\TestCase;

class OrgApplicationDecisionMailTest extends TestCase
{
    private function makeUser(string $name = 'Sample User', string $email = 'sample@example.com'): User
    {
        $u = new User();
        $u->name = $name;
        $u->email = $email;
        return $u;
    }

    public function test_approved_content_includes_join_org_cta(): void
    {
        $user = $this->makeUser('Sample Person');
        $mail = new OrgApplicationDecision($user, 'approved', 'Looks great!', 'Sample Tenant');
        $html = $mail->render();

        $this->assertStringContainsString('Application Update', $html);
        $this->assertStringContainsString('Hi Sample,', $html);
        $this->assertStringContainsString('Status: Approved ✅', $html);
        $this->assertStringContainsString('Looks great!', $html);
        $this->assertStringContainsString('Join an Org', $html);
        $this->assertStringContainsString('Wishing you clear skies and calm waters,', $html);
    }

    public function test_rejected_content_includes_default_note_and_appeal(): void
    {
        $user = $this->makeUser('Sample Person');
        $mail = new OrgApplicationDecision($user, 'rejected', null, 'Sample Tenant');
        $html = $mail->render();

        $this->assertStringContainsString('Status: Rejected ❌', $html);
        $this->assertStringContainsString('Unfortunately, your application did not meet the current requirements.', $html);
        $this->assertStringContainsString('bantaylawa.ph@gmail.com', $html);
    }

    public function test_needs_changes_content_includes_instructions(): void
    {
        $user = $this->makeUser('Sample Person');
        $mail = new OrgApplicationDecision($user, 'needs_changes', null, 'Sample Tenant');
        $html = $mail->render();

        $this->assertStringContainsString('Status: Needs Changes ✏️', $html);
        $this->assertStringContainsString('Some information or documents need your attention before we can proceed.', $html);
        $this->assertStringContainsString('Organization Applications', $html);
        $this->assertStringContainsString('Thank you for your prompt attention to this matter.', $html);
    }
}
