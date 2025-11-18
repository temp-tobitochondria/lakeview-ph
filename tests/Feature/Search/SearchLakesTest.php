<?php

it('performs semantic lake search', function () {
    $resp = $this->postJson('/api/search', ['query' => 'lake']);
    $this->assertTrue(in_array($resp->status(), [200, 422]), 'Unexpected search status: '.$resp->status());
})->group('search')->todo('Differentiate success vs validation responses and assert data shape.');
