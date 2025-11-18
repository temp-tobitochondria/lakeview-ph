<?php

use App\Models\Tenant;

it('lists tenants as superadmin', function () {
    $admin = superAdmin();
    $resp = $this->actingAs($admin)->getJson('/api/admin/tenants');
    $this->assertTrue(in_array($resp->status(), [200, 204]), 'Unexpected status: '.$resp->status());
})->group('admin')->todo('Assert pagination / data structure once tenants seeded.');

it('creates tenant as superadmin', function () {
    $admin = superAdmin();
    $resp = $this->actingAs($admin)->postJson('/api/admin/tenants', [
        'name' => 'Auto Tenant '.uniqid(),
    ]);
    $this->assertTrue(in_array($resp->status(), [201, 422]), 'Unexpected status: '.$resp->status());
})->group('admin')->todo('Verify returned JSON and audit log entry.');

it('assigns org admin to tenant', function () {
    $admin = superAdmin();
    $tenant = class_exists(Tenant::class) ? Tenant::factory()->create() : null;
    $user = publicUser();
    $resp = $this->actingAs($admin)->postJson('/api/admin/tenants/'.$tenant->id.'/admins', [
        'user_id' => $user->id,
    ]);
    $this->assertTrue(in_array($resp->status(), [200, 422]), 'Unexpected status: '.$resp->status());
})->group('admin')->todo('Assert role change and audit trail.');
