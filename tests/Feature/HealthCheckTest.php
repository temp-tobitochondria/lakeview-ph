<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class HealthCheckTest extends TestCase
{
    use RefreshDatabase;

    public function testHealthCheck()
    {
        $response = $this->getJson('/api/healthz/db');
        $response->assertStatus(200);
        $response->assertJsonStructure(['ok','db','migrations']);
        $payload = $response->json();
        $this->assertTrue($payload['ok']);
    }
}