<?php

use App\Models\Role;
use App\Models\User;

it('logs in with valid credentials', function () {
    ensureRoles();
    $role = Role::where('name', Role::PUBLIC)->first();
    $password = 'Secret123!';
    $user = User::factory()->create([
        'role_id' => $role->id,
        'password' => bcrypt($password),
        'email' => 'auth_valid@example.test',
    ]);

    $resp = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => $password,
    ]);

    $resp->assertOk()->assertJsonStructure(['token']);
})->group('auth');

it('rejects login with wrong password', function () {
    ensureRoles();
    $role = Role::where('name', Role::PUBLIC)->first();
    $user = User::factory()->create([
        'role_id' => $role->id,
        'password' => bcrypt('CorrectPass123!'),
        'email' => 'auth_invalid@example.test',
    ]);

    $resp = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'WrongPass',
    ]);

    // Depending on validation/auth flow this may be 401 or 422; adjust if needed
    $this->assertTrue(in_array($resp->status(), [401, 422]), 'Expected 401 or 422 status, got '.$resp->status());
})->group('auth');

it('retrieves current user after login', function () {
    ensureRoles();
    $role = Role::where('name', Role::PUBLIC)->first();
    $password = 'Secret123!';
    $user = User::factory()->create([
        'role_id' => $role->id,
        'password' => bcrypt($password),
        'email' => 'auth_me@example.test',
    ]);

    $login = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => $password,
    ])->assertOk();

    $token = $login->json('token');
    $me = $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/auth/me');
    $me->assertOk()->assertJsonPath('email', $user->email);
})->group('auth');
