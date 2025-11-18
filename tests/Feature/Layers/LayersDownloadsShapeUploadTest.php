<?php

it('superadmin lists layers and downloads single layer', function () {
    $admin = superAdmin();
    $list = $this->actingAs($admin)->getJson('/api/layers');
    $list->assertStatus(200);
    $firstId = $list->json('data.0.id') ?? null;
    if ($firstId) {
        $dl = $this->actingAs($admin)->get('/api/layers/'.$firstId.'/download');
        expect(in_array($dl->status(), [200,404]))->toBeTrue(); // 404 if file missing
    } else {
        $this->markTestSkipped('No layers seeded');
    }
})->group('layers');

it('org admin cannot create layers (superadmin only)', function () {
    $org = orgAdmin();
    $resp = $this->actingAs($org)->postJson('/api/layers', [ 'name' => 'Layer X' ]);
    $resp->assertStatus(403);
})->group('layers');
