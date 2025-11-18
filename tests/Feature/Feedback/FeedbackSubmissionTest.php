<?php

use App\Models\Role;
use App\Models\Feedback;
use App\Models\User;

it('submits feedback as authenticated user', function () {
    ensureRoles();
    $role = Role::where('name', Role::PUBLIC)->first();
    $user = User::factory()->create(['role_id' => $role->id]);

    $resp = $this->actingAs($user)->postJson('/api/feedback', [
        'title' => 'Pest Feedback',
        'message' => 'Initial migration test',
        'category' => 'migration'
    ]);

    $resp->assertCreated()->assertJsonPath('data.status', Feedback::STATUS_OPEN);
})->group('feedback');
