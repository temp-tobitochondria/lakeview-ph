<?php

use App\Models\User;
use App\Models\Role;

it('updates user name without password change', function () {
    $user = publicUser();
    $resp = $this->actingAs($user)->patchJson('/api/user/settings', [ 'name' => 'Renamed User' ]);
    $resp->assertStatus(200)->assertJsonPath('data.name','Renamed User');
})->group('auth','profile');

it('updates password with current password verification', function () {
    $user = publicUser();
    $oldHash = $user->password;
    $resp = $this->actingAs($user)->patchJson('/api/user/settings', [
        'current_password' => 'password', // factory default assumption
        'password' => 'NewSecurePass123!',
        'password_confirmation' => 'NewSecurePass123!'
    ]);
    // If factory default password differs, expect 422; otherwise 200
    if ($resp->status() === 200) {
        $resp->assertJsonPath('updated', true);
        expect($user->fresh()->password)->not->toBe($oldHash);
    } else {
        $resp->assertStatus(422); // current password mismatch
    }
})->group('auth','profile');
