<?php

it('performs full forgot password cycle', function () {
    $user = publicUser();
    $email = $user->email;

    // 1. Request OTP (test_code exposed in testing env)
    $reqResp = $this->postJson('/api/auth/forgot/request-otp', ['email' => $email]);
    $reqResp->assertStatus(200)->assertJsonStructure(['ok','cooldown_seconds','test_code']);
    $code = $reqResp->json('test_code');
    expect($code)->toHaveLength(6);

    // 2. Verify OTP to obtain reset ticket
    $verifyResp = $this->postJson('/api/auth/forgot/verify-otp', ['email' => $email, 'code' => $code]);
    $verifyResp->assertStatus(200)->assertJsonStructure(['ok','ticket','ticket_expires_in']);
    $ticket = $verifyResp->json('ticket');

    // 3. Reset password with ticket
    $newPassword = 'NewSecret123!';
    $resetResp = $this->postJson('/api/auth/forgot/reset', [
        'ticket' => $ticket,
        'password' => $newPassword,
        'password_confirmation' => $newPassword,
    ]);
    $resetResp->assertStatus(200)->assertJson(['ok' => true]);

    // 4. Login with new password
    $loginResp = $this->postJson('/api/auth/login', ['email' => $email, 'password' => $newPassword]);
    $loginResp->assertStatus(200)->assertJsonStructure(['token','data']);
})->group('auth','password');
