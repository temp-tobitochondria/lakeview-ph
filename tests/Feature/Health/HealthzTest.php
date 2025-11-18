<?php

it('returns database health payload', function () {
    $resp = $this->getJson('/api/healthz/db');
    $resp->assertOk()->assertJsonStructure(['ok','db','migrations']);
    expect($resp->json('ok'))->toBeTrue();
})->group('health');
