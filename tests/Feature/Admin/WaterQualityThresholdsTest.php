<?php

it('lists water quality thresholds as superadmin', function () {
    $admin = superAdmin();
    $resp = $this->actingAs($admin)->getJson('/api/admin/parameter-thresholds');
    $this->assertTrue(in_array($resp->status(), [200,204]), 'Unexpected status: '.$resp->status());
})->group('admin','wq')->todo('Assert threshold fields and pagination.');

it('prevents public user from listing thresholds', function () {
    $user = publicUser();
    $resp = $this->actingAs($user)->getJson('/api/admin/parameter-thresholds');
    expect($resp->status())->toBeIn([401,403]);
})->group('admin','wq');
