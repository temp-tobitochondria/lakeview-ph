<?php

use App\Models\Parameter;
use App\Models\ParameterThreshold;
use App\Models\WaterQualityClass;
use App\Models\WqStandard;
use App\Models\SamplingEvent;
use App\Models\SampleResult;
use App\Models\Lake;
use App\Models\Tenant;
use App\Models\Station;

it('evaluates max and min threshold types for pass/fail outcomes', function () {
    $admin = superAdmin();
    $this->actingAs($admin);
    $class = WaterQualityClass::first() ?: WaterQualityClass::create(['code'=>'B','name'=>'Class B']);
    $standard = WqStandard::factory()->create(['code'=>'STDX','name'=>'Std X','is_current'=>true]);
    $paramMax = Parameter::factory()->create(['code'=>'NIT','name'=>'Nitrate','evaluation_type'=>'Max (≤)','unit'=>'mg/L']);
    $paramMin = Parameter::factory()->create(['code'=>'DO','name'=>'Dissolved Oxygen','evaluation_type'=>'Min (≥)','unit'=>'mg/L']);
    ParameterThreshold::factory()->create(['parameter_id'=>$paramMax->id,'class_code'=>$class->code,'standard_id'=>$standard->id,'max_value'=>10.0]);
    ParameterThreshold::factory()->create(['parameter_id'=>$paramMin->id,'class_code'=>$class->code,'standard_id'=>$standard->id,'min_value'=>5.0]);
    $tenant = Tenant::factory()->create();
    $lake = Lake::factory()->create(['class_code'=>$class->code]);
    $station = Station::factory()->create(['organization_id'=>$tenant->id]);
    $event = SamplingEvent::factory()->create(['organization_id'=>$tenant->id,'lake_id'=>$lake->id,'station_id'=>$station->id,'applied_standard_id'=>$standard->id,'sampled_at'=>now()->toDateString(),'status'=>'draft']);
    // Max pass
    $r1 = SampleResult::factory()->create(['sampling_event_id'=>$event->id,'parameter_id'=>$paramMax->id,'value'=>9.5]);
    app(\App\Services\WaterQualityEvaluator::class)->evaluate($r1, true);
    expect($r1->fresh()->pass_fail)->toBe('pass');
    // Max fail
    $r2 = SampleResult::factory()->create(['sampling_event_id'=>$event->id,'parameter_id'=>$paramMax->id,'value'=>12.0]);
    app(\App\Services\WaterQualityEvaluator::class)->evaluate($r2, true);
    expect($r2->fresh()->pass_fail)->toBe('fail');
    // Min pass
    $r3 = SampleResult::factory()->create(['sampling_event_id'=>$event->id,'parameter_id'=>$paramMin->id,'value'=>6.0]);
    app(\App\Services\WaterQualityEvaluator::class)->evaluate($r3, true);
    expect($r3->fresh()->pass_fail)->toBe('pass');
    // Min fail
    $r4 = SampleResult::factory()->create(['sampling_event_id'=>$event->id,'parameter_id'=>$paramMin->id,'value'=>3.0]);
    app(\App\Services\WaterQualityEvaluator::class)->evaluate($r4, true);
    expect($r4->fresh()->pass_fail)->toBe('fail');
})->group('water-quality','evaluation');
