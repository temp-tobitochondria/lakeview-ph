<?php

it('performs semantic search query', function () {
    $resp = $this->postJson('/api/search', [ 'q' => 'largest lakes' ]);
    expect(in_array($resp->status(), [200,422]))->toBeTrue();
})->group('search','analytics');
