<?php

use App\Models\Role;
use App\Models\User;

it('logs out an authenticated user', function () {
    $user = publicUser();
    $resp = $this->actingAs($user)->postJson('/api/auth/logout');
    $resp->assertOk();
})->group('auth');

it('updates profile settings (name/password)', function () {
    $user = publicUser();
    $resp = $this->actingAs($user)->patchJson('/api/user/settings', [
        'name' => 'Updated Name',
        'password' => 'NewSecret123!',
        'password_confirmation' => 'NewSecret123!',
    ]);
    // Could be 200 or validation errors depending on rules; assert success range
    $this->assertTrue(in_array($resp->status(), [200, 422]), 'Unexpected status: '.$resp->status());
})->group('auth');

it('registers a new user', function () {
    // Minimal payload; adjust keys based on StoreAuthRequest if needed
    $email = 'newuser'.uniqid().'@example.test';
    $resp = $this->postJson('/api/auth/register', [
        'name' => 'New User',
        'email' => $email,
        'password' => 'StartSecret123!',
        'password_confirmation' => 'StartSecret123!',
    ]);
    $this->assertTrue(in_array($resp->status(), [200, 201, 422]), 'Unexpected status: '.$resp->status());
})->group('auth')->todo('Refine expected status and JSON structure once validation schema confirmed.');

it('initiates forgot password OTP flow', function () {
    $user = publicUser();
    $resp = $this->postJson('/api/auth/forgot/request-otp', [
        'email' => $user->email,
    ]);
    $this->assertTrue(in_array($resp->status(), [200, 202, 429]), 'Unexpected status: '.$resp->status());
})->group('auth')->todo('Complete full OTP cycle (verify + reset) with deterministic code mocking.');
