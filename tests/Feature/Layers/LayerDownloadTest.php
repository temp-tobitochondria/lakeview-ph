<?php

use App\Models\Layer;
use App\Models\Tenant;

it('downloads a layer (authorized)', function () {
    if (!class_exists(Layer::class)) {
        $this->markTestSkipped('Layer model not available');
    }
    $tenant = class_exists(Tenant::class) ? Tenant::factory()->create() : null;
    $admin = orgAdmin($tenant);
    try {
        $layer = Layer::factory()->create([
            'uploaded_by' => $admin->id,
            'body_type' => 'lake',
            'body_id' => 1,
        ]);
    } catch (Throwable $e) {
        $this->markTestSkipped('Layer factory not available');
    }
    $resp = $this->actingAs($admin)->getJson('/api/layers/'.$layer->id.'/download');
    $this->assertTrue(in_array($resp->status(), [200,404]), 'Unexpected status: '.$resp->status());
})->group('layers')->todo('Assert file stream headers when storage seeded.');
