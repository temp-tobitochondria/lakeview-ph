<?php

it('rejects guest feedback with too short message/description', function () {
    // Empty description and short message (<10 chars) should fail
    $resp = $this->postJson('/api/public/feedback', [
        'title' => 'Hi', // below min title length not required but message invalid
        'message' => 'short', // 5 chars
        'website' => '',
    ]);
    $resp->assertStatus(422)->assertJsonStructure(['message','errors']);
    expect($resp->json('errors.message.0') ?? '')->toContain('10');
});
