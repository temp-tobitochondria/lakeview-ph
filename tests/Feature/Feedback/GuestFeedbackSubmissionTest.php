<?php

use App\Models\Feedback;
use Illuminate\Support\Facades\Config;

it('allows guest to submit feedback via public endpoint', function () {
    // Ensure no strict CORS blocks in test runtime
    Config::set('app.url', 'http://localhost');

    $resp = $this->postJson('/api/public/feedback', [
        'title' => 'Guest Feedback',
        'description' => 'There is a typo on the page.',
        'type' => 'Other',
        'guest_name' => 'Guesty McGuestface',
        'guest_email' => 'guest@example.org',
        // Honeypot must be empty or absent
        'website' => '',
    ]);

    $resp->assertCreated();
    $data = $resp->json('data');
    expect($data)
        ->toHaveKeys(['id','title','message','status','is_guest'])
        ->and($data['is_guest'])->toBeTrue()
        ->and($data['status'])->toBe(Feedback::STATUS_OPEN);
})->group('feedback','guest');
