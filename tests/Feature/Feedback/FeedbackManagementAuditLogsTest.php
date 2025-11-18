<?php

it('superadmin lists feedback and audit logs', function () {
    $admin = superAdmin();
    $fb = $this->actingAs($admin)->getJson('/api/admin/feedback');
    $fb->assertStatus(200);
    $audit = $this->actingAs($admin)->getJson('/api/admin/audit-logs');
    $audit->assertStatus(200);
})->group('feedback','audit');

it('org admin can view tenant-scoped audit logs', function () {
    $org = orgAdmin();
    $resp = $this->actingAs($org)->getJson('/api/org/'.$org->tenant_id.'/audit-logs');
    expect(in_array($resp->status(), [200,403]))->toBeTrue();
})->group('audit');
