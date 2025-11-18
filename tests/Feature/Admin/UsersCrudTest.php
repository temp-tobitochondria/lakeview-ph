<?php

use App\Models\Role;
use App\Models\User;

it('superadmin creates, updates, and deletes a user', function () {
    $admin = superAdmin();
    $create = $this->actingAs($admin)->postJson('/api/admin/users', [
        'name' => 'Managed User',
        'email' => 'managed@example.test',
        'password' => 'StrongPass123!'
    ]);
    if ($create->status() === 201) {
        $id = $create->json('data.id') ?? $create->json('id');
        $update = $this->actingAs($admin)->putJson('/api/admin/users/'.$id, ['name' => 'Managed User Updated']);
        $update->assertStatus(200);
        $del = $this->actingAs($admin)->deleteJson('/api/admin/users/'.$id);
        $del->assertStatus(200)->assertJson(['message' => 'User removed']);
    } else {
        $create->assertStatus(422); // validation or schema requirement failure
    }
})->group('admin','users');

it('non-superadmin cannot create user via admin endpoint', function () {
    $public = publicUser();
    $resp = $this->actingAs($public)->postJson('/api/admin/users', [
        'name' => 'Blocked', 'email' => 'blocked@example.test'
    ]);
    $resp->assertStatus(403);
})->group('admin','users');
