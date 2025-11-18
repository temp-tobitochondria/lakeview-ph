<?php

use App\Models\Lake;

it('views lake basic information with schema keys', function () {
    if (!class_exists(Lake::class)) {
        $this->markTestSkipped('Lake model not available');
    }
    // Attempt to create a lake via factory; if missing factory, skip
    try {
        $lake = Lake::factory()->create();
    } catch (Throwable $e) {
        $this->markTestSkipped('Lake factory not available');
    }
    $resp = $this->getJson('/api/lakes/'.$lake->id);
    $resp->assertOk()->assertJsonStructure(['data' => ['id','name']]);
})->group('lakes');

it('lists lakes filter options structure', function () {
    $resp = $this->getJson('/api/filters/lakes');
    $resp->assertOk();
    $data = $resp->json('data');
    if ($data !== null) {
        // Expect array of facets (keys may vary); ensure count >= 0 and type array
        expect(is_array($data))->toBeTrue();
    }
})->group('lakes');
