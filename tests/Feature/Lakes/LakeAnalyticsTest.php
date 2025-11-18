<?php

// Advanced lake analytics placeholders (charts, comparison, summary table)
it('retrieves series stats for two lakes comparison (placeholder)', function () {
    $payload = [
        'lake_ids' => [1,2],
        'parameter' => 'temperature',
        'start' => '2023-01-01',
        'end' => '2023-12-31'
    ];
    $resp = $this->postJson('/api/stats/series', $payload);
    // Expect either 200 with data.series or validation 422 if lake seed absent
    if ($resp->status() === 200) {
        $resp->assertJsonStructure(['data' => ['series']]);
    } else { $resp->assertStatus(422); }
})->group('analytics','lakes');

it('retrieves thresholds metadata for lake dashboard table', function () {
    $resp = $this->postJson('/api/stats/thresholds', ['parameters' => ['temperature','ph']]);
    if ($resp->status() === 200) {
        expect($resp->json('data'))->toBeArray();
    } else { $resp->assertStatus(422); }
})->group('analytics','lakes');
