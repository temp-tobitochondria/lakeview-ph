<?php

use App\Models\Feedback;

it('lists own feedback after submission with expected fields', function () {
    $user = publicUser();
    $create = $this->actingAs($user)->postJson('/api/feedback', [
        'title' => 'Mine List',
        'message' => 'Listing test',
        'category' => 'other'
    ])->assertCreated();

    $mine = $this->actingAs($user)->getJson('/api/feedback/mine');
    $mine->assertOk();
    $rows = $mine->json('data');
    expect($rows)->toBeArray();
    $found = collect($rows)->first(fn($r) => ($r['id'] ?? null) === $create->json('data.id'));
    expect($found)->not->toBeNull()->toHaveKeys(['id','title','status']);
})->group('feedback');
