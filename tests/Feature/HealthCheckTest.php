<?php

use PHPUnit\Framework\TestCase;

class HealthCheckTest extends TestCase
{
    public function testHealthCheck()
    {
        $response = $this->get('/health-check');
        $this->assertEquals(200, $response->getStatusCode());
        $this->assertJson($response->getContent());
        $this->assertArrayHasKey('status', json_decode($response->getContent(), true));
    }
}