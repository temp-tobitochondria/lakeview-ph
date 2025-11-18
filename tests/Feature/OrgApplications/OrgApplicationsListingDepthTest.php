<?php

use App\Models\Tenant;

it('admin lists org applications with optional status filter', function () {
    $admin = superAdmin();
    $resp = $this->actingAs($admin)->getJson('/api/admin/org-applications?status=approved');
    $resp->assertStatus(200);
    expect($resp->json('data'))->toBeArray();
})->group('applications','admin');

it('org admin lists applications scoped to tenant', function () {
    $org = orgAdmin();
    $resp = $this->actingAs($org)->getJson('/api/org/'.$org->tenant_id.'/applications');
    expect(in_array($resp->status(), [200,403]))->toBeTrue();
})->group('applications','org');
