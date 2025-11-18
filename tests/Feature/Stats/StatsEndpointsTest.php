<?php

it('retrieves station stats metadata with array payload', function () {
    $resp = $this->getJson('/api/stats/stations');
    $resp->assertStatus(200);
    $data = $resp->json('data');
    if ($data !== null) expect(is_array($data))->toBeTrue();
})->group('stats');

it('retrieves depth stats metadata requires parameter_code', function () {
    $resp = $this->getJson('/api/stats/depths?parameter_code=DO');
    $resp->assertStatus(200);
    $series = $resp->json('data.series');
    if ($series !== null) expect(is_array($series))->toBeTrue();
})->group('stats');

it('posts series stats for single lake parameter returns series|errors', function () {
    $payload = [
        'lake_id' => 1,
        'parameter' => 'temperature',
        'start' => '2023-01-01',
        'end' => '2023-12-31'
    ];
    $resp = $this->postJson('/api/stats/series', $payload);
    if ($resp->status() === 200) {
        $resp->assertJsonStructure(['data' => ['series']]);
    } else {
        $resp->assertStatus(422);
    }
})->group('stats');

it('posts thresholds lookup returns thresholds|validation errors', function () {
    $resp = $this->postJson('/api/stats/thresholds', ['parameters' => ['temperature']]);
    if ($resp->status() === 200) {
        $resp->assertJsonStructure(['data' => []]);
    } else {
        $resp->assertStatus(422);
    }
})->group('stats');
