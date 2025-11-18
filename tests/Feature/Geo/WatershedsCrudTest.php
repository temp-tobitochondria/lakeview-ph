<?php

use App\Models\Watershed;

it('superadmin creates, updates, and deletes watershed', function () {
    $admin = superAdmin();
    $create = $this->actingAs($admin)->postJson('/api/watersheds', ['name' => 'WS Test']);
    if ($create->status() === 201) {
        $id = $create->json('id');
        $update = $this->actingAs($admin)->putJson('/api/watersheds/'.$id, ['name' => 'WS Test Updated']);
        $update->assertStatus(200)->assertJsonPath('name','WS Test Updated');
        $del = $this->actingAs($admin)->deleteJson('/api/watersheds/'.$id);
        $del->assertStatus(200);
    } else { $create->assertStatus(422); }
})->group('geo','watersheds');

it('public user forbidden to create watershed', function () {
    $public = publicUser();
    $resp = $this->actingAs($public)->postJson('/api/watersheds', ['name' => 'Blocked WS']);
    $resp->assertStatus(403);
})->group('geo','watersheds');
