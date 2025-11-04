<?php

namespace Tests\Feature;

use App\Mail\FeedbackAdminReplyMail;
use App\Mail\FeedbackStatusChangedMail;
use App\Models\Feedback;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class FeedbackEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (class_exists(\Database\Seeders\RolesSeeder::class)) {
            $this->seed(\Database\Seeders\RolesSeeder::class);
        } else {
            Role::query()->insert([
                ['name' => Role::SUPERADMIN, 'scope' => 'system'],
                ['name' => Role::ORG_ADMIN, 'scope' => 'tenant'],
                ['name' => Role::CONTRIBUTOR, 'scope' => 'tenant'],
                ['name' => Role::PUBLIC, 'scope' => 'system'],
            ]);
        }
    }

    public function test_email_sent_on_status_change_for_registered_user()
    {
        Mail::fake();

        $userRole = Role::where('name', Role::PUBLIC)->first();
        $adminRole = Role::where('name', Role::SUPERADMIN)->first();

        $user = User::factory()->create(['role_id' => $userRole->id, 'email' => 'user@example.com']);
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        $fb = Feedback::create([
            'user_id' => $user->id,
            'title' => 'Bug: Something broken',
            'message' => 'Steps to reproduce...',
            'category' => 'bug',
            'status' => Feedback::STATUS_OPEN,
            'is_guest' => false,
        ]);

        $resp = $this->actingAs($admin)->patchJson('/api/admin/feedback/'.$fb->id, [
            'status' => Feedback::STATUS_RESOLVED,
        ]);
        $resp->assertOk();

        Mail::assertQueued(FeedbackStatusChangedMail::class, function ($mail) use ($fb) {
            return $mail->feedback->id === $fb->id && $mail->newStatus === Feedback::STATUS_RESOLVED;
        });
    }

    public function test_no_email_for_guest_feedback()
    {
        Mail::fake();

        $adminRole = Role::where('name', Role::SUPERADMIN)->first();
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        $fb = Feedback::create([
            'title' => 'Guest report',
            'message' => 'Guest cannot be contacted.',
            'category' => 'bug',
            'status' => Feedback::STATUS_OPEN,
            'is_guest' => true,
            'guest_name' => 'Anon',
            'guest_email' => null,
        ]);

        $resp = $this->actingAs($admin)->patchJson('/api/admin/feedback/'.$fb->id, [
            'status' => Feedback::STATUS_IN_PROGRESS,
            'admin_response' => 'We are looking into this.',
        ]);
        $resp->assertOk();

        Mail::assertNotQueued(FeedbackStatusChangedMail::class);
        Mail::assertNotQueued(FeedbackAdminReplyMail::class);
    }

    public function test_email_sent_on_admin_reply_for_registered_user()
    {
        Mail::fake();

        $userRole = Role::where('name', Role::PUBLIC)->first();
        $adminRole = Role::where('name', Role::SUPERADMIN)->first();
        $user = User::factory()->create(['role_id' => $userRole->id, 'email' => 'user2@example.com']);
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        $fb = Feedback::create([
            'user_id' => $user->id,
            'title' => 'UI issue',
            'message' => 'Text overlaps on small screens',
            'category' => 'ui',
            'status' => Feedback::STATUS_OPEN,
            'is_guest' => false,
        ]);

        $resp = $this->actingAs($admin)->patchJson('/api/admin/feedback/'.$fb->id, [
            'admin_response' => 'Fix will be deployed next week.',
        ]);
        $resp->assertOk();

        Mail::assertQueued(FeedbackAdminReplyMail::class, function ($mail) use ($fb) {
            return $mail->feedback->id === $fb->id && str_contains($mail->reply, 'Fix will be deployed');
        });
    }
}
