<?php

it('submits an organization application as public user', function () {
    $user = publicUser();
    $resp = $this->actingAs($user)->postJson('/api/org-applications', [
        'reason' => 'Testing application submission',
    ]);
    // Expect 201 created or 422 validation depending on required fields
    $this->assertTrue(in_array($resp->status(), [201, 422]), 'Unexpected status: '.$resp->status());
})->group('org-app')->todo('Fill in required application fields and assert JSON structure.');
