<?php

it('lists water quality parameters as superadmin', function () {
    $admin = superAdmin();
    $resp = $this->actingAs($admin)->getJson('/api/admin/parameters');
    $this->assertTrue(in_array($resp->status(), [200,204]), 'Unexpected status: '.$resp->status());
})->group('admin','wq')->todo('Assert JSON structure, count, and filtering once seeders added.');

it('creates water quality parameter (superadmin)', function () {
    $admin = superAdmin();
    $payload = [
        'name' => 'Temp '.uniqid(),
        'unit' => 'C',
        'code' => 'TEMP'.rand(10,99)
    ];
    $resp = $this->actingAs($admin)->postJson('/api/admin/parameters', $payload);
    $this->assertTrue(in_array($resp->status(), [201,422]), 'Unexpected status: '.$resp->status());
})->group('admin','wq')->todo('Complete with required fields and success assertion.');

it('rejects parameter creation by public user', function () {
    $user = publicUser();
    $payload = [ 'name' => 'Should Fail', 'unit' => 'X', 'code' => 'FAIL' ];
    $resp = $this->actingAs($user)->postJson('/api/admin/parameters', $payload);
    expect($resp->status())->toBeIn([401,403]);
})->group('admin','wq');
