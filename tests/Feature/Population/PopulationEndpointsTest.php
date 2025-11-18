<?php

it('estimates population around buffer', function () {
    $resp = $this->getJson('/api/population/estimate?lake_id=1&radius_km=5');
    $this->assertTrue(in_array($resp->status(), [200, 422]), 'Unexpected status: '.$resp->status());
})->group('population')->todo('Provide seeded raster data and assert numeric estimate.');

it('lists population dataset years', function () {
    $resp = $this->getJson('/api/population/dataset-years');
    $this->assertTrue(in_array($resp->status(), [200, 204]), 'Unexpected status: '.$resp->status());
})->group('population');

it('retrieves population dataset info', function () {
    // Provide a year parameter; controller returns 400 when year missing.
    $resp = $this->getJson('/api/population/dataset-info?year=2025');
    $this->assertTrue(in_array($resp->status(), [200, 204]), 'Unexpected status: '.$resp->status());
})->group('population');
