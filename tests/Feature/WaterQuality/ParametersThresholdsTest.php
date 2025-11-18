<?php

use App\Models\Role;
use App\Models\Parameter;
use App\Models\ParameterThreshold;
use App\Models\WaterQualityClass;
use App\Models\WqStandard;
use App\Models\SampleResult;
use App\Models\SamplingEvent;
use App\Models\Lake;
use App\Models\Tenant;
use App\Models\Station;

/**
 * Deep CRUD + evaluation linkage tests for parameters & thresholds.
 */
it('superadmin performs full parameter CRUD and validation', function () {
    $admin = superAdmin();
    $this->actingAs($admin);

    // Create parameter
    $create = $this->postJson('/api/admin/parameters', [
        'code' => 'TEMP',
        'name' => 'Temperature',
        'unit' => 'C',
        'evaluation_type' => 'Range',
        'desc' => 'Water temperature'
    ]);
    $create->assertStatus(201)->assertJsonPath('code', 'TEMP');
    $paramId = $create->json('id');

    // Duplicate code should fail
    $dup = $this->postJson('/api/admin/parameters', [
        'code' => 'TEMP',
        'name' => 'Temp Duplicate'
    ]);
    $dup->assertStatus(422);

    // Update evaluation_type (synonym test: "Maximum" should normalize to max later in evaluator)
    $update = $this->putJson('/api/admin/parameters/'.$paramId, [ 'evaluation_type' => 'Maximum', 'name' => 'Temperature Updated' ]);
    $update->assertStatus(200)->assertJsonPath('name', 'Temperature Updated');

    // Show includes thresholds array (empty now)
    $show = $this->getJson('/api/admin/parameters/'.$paramId);
    $show->assertStatus(200)->assertJsonStructure(['data' => ['id','code','thresholds']]);

    // Delete
    $del = $this->deleteJson('/api/admin/parameters/'.$paramId);
    $del->assertStatus(200);
})->group('water-quality','parameters');

it('enforces permission: non-superadmin cannot create parameter', function () {
    $public = publicUser();
    $resp = $this->actingAs($public)->postJson('/api/admin/parameters', [ 'code' => 'DO', 'name' => 'Dissolved Oxygen' ]);
    $resp->assertStatus(403);
})->group('water-quality','parameters');

it('superadmin creates threshold with class + optional standard and evaluator applies result', function () {
    $admin = superAdmin();
    $this->actingAs($admin);
    // Seed parameter
    $param = Parameter::factory()->create(['code' => 'PH','name' => 'pH','evaluation_type' => 'Range','unit' => null]);

    // Seed water quality class
    $class = WaterQualityClass::first() ?: WaterQualityClass::create(['code' => 'A','name' => 'Class A']);
    // Seed standard (current)
    $standard = WqStandard::factory()->create(['code' => 'STD1','name' => 'Primary Standard','is_current' => true]);

    // Create threshold with both min & max for range evaluation
    $thresholdResp = $this->postJson('/api/admin/parameter-thresholds', [
        'parameter_id' => $param->id,
        'class_code' => $class->code,
        'standard_id' => $standard->id,
        'min_value' => 6.5,
        'max_value' => 8.5,
        'notes' => 'Acceptable pH range'
    ]);
    $thresholdResp->assertStatus(201)->assertJsonPath('parameter_id', $param->id);
    $thresholdId = $thresholdResp->json('id');

    // Update threshold narrowing range
    $update = $this->putJson('/api/admin/parameter-thresholds/'.$thresholdId, [ 'min_value' => 6.8, 'max_value' => 8.2 ]);
    $update->assertStatus(200)->assertJsonPath('min_value', 6.8);

    // Evaluator scenario: create sampling event + sample result then verify pass/fail logic
    $tenant = Tenant::factory()->create();
    $lake = Lake::factory()->create(['class_code' => $class->code]);
    $station = Station::factory()->create(['organization_id' => $tenant->id]);
    $event = SamplingEvent::factory()->create([
        'organization_id' => $tenant->id,
        'lake_id' => $lake->id,
        'station_id' => $station->id,
        'applied_standard_id' => $standard->id,
        'sampled_at' => now()->toDateString(),
        'status' => 'draft'
    ]);

    /** @var SampleResult $result */
    $result = SampleResult::factory()->create([
        'sampling_event_id' => $event->id,
        'parameter_id' => $param->id,
        'value' => 7.2,
    ]);

    app(\App\Services\WaterQualityEvaluator::class)->evaluate($result, true);
    $resultFresh = $result->fresh();
    expect($resultFresh->pass_fail)->toBe('pass')->and($resultFresh->threshold_id)->toBe($thresholdId);

    // Fail case outside range
    $failResult = SampleResult::factory()->create([
        'sampling_event_id' => $event->id,
        'parameter_id' => $param->id,
        'value' => 9.0,
    ]);
    app(\App\Services\WaterQualityEvaluator::class)->evaluate($failResult, true);
    expect($failResult->fresh()->pass_fail)->toBe('fail');

    // Delete threshold
    $del = $this->deleteJson('/api/admin/parameter-thresholds/'.$thresholdId);
    $del->assertStatus(200);
})->group('water-quality','thresholds','evaluation');

it('threshold creation requires existing class and parameter', function () {
    $admin = superAdmin();
    $this->actingAs($admin);
    // Missing parameter id should 422
    $bad = $this->postJson('/api/admin/parameter-thresholds', [
        'parameter_id' => 999999,
        'class_code' => 'ZZ',
    ]);
    $bad->assertStatus(422);
})->group('water-quality','thresholds');

it('non-superadmin cannot manage thresholds', function () {
    $public = publicUser();
    $resp = $this->actingAs($public)->postJson('/api/admin/parameter-thresholds', [
        'parameter_id' => 1,
        'class_code' => 'A'
    ]);
    $resp->assertStatus(403);
})->group('water-quality','thresholds');
