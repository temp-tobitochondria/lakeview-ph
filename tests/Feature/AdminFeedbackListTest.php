<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Role;
use App\Models\Feedback;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminFeedbackListTest extends TestCase
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

    public function test_superadmin_can_list_feedback_with_pagination()
    {
        $adminRole = Role::where('name', Role::SUPERADMIN)->first();
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        // create some feedback entries
        Feedback::factory()->count(3)->create();

        $resp = $this->actingAs($admin)->getJson('/api/admin/feedback?page=1&per_page=2');
        $resp->assertOk();
        $resp->assertJsonStructure([
            'current_page','data','from','last_page','per_page','to','total'
        ]);
        $this->assertCount(2, $resp->json('data'));
    }
}
