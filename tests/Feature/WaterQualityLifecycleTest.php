<?php

use App\Models\Tenant;
use App\Models\Lake;
use App\Models\Station;
use App\Models\Parameter;
use App\Models\SamplingEvent;
use App\Models\Role;

it('covers sampling event CRUD with publish/unpublish and role permissions', function () {
    // Arrange base data
    ensureRoles();
    $tenant = Tenant::factory()->create();
    $lake = Lake::factory()->create();
    // Station must belong to tenant (organization_id field assumed)
    $station = Station::factory()->create(['organization_id' => $tenant->id]);
    $parameter = Parameter::factory()->create([
        'code' => 'TEMP',
        'name' => 'Temperature',
        'unit' => 'C',
        'evaluation_type' => 'Range',
    ]);

    $orgAdmin = orgAdmin($tenant); // has tenant_id
    $contributor = userWithRole(Role::CONTRIBUTOR); // auto tenant via helper; override to match
    $contributor->tenant_id = $tenant->id; $contributor->save();
    $super = superAdmin();

    // 1. Org admin creates draft event with one measurement
    $this->actingAs($orgAdmin);
    $createResp = $this->postJson('/api/org/'.$tenant->id.'/sample-events', [
        'lake_id' => $lake->id,
        'station_id' => $station->id,
        'sampled_at' => now()->toDateString(),
        'status' => 'draft',
        'measurements' => [
            ['parameter_id' => $parameter->id, 'value' => 25.4, 'unit' => 'C']
        ],
    ]);
    $createResp->assertStatus(201)->assertJsonStructure(['data' => ['id','status','results_count']]);
    $eventId = $createResp->json('data.id');
    expect($createResp->json('data.status'))->toBe('draft');
    expect($createResp->json('data.results_count'))->toBe(1);

    // 2. Contributor attempts to publish (should 403 on store if status public OR toggle if not creator?)
    $this->actingAs($contributor);
    $pubAttempt = $this->postJson('/api/org/'.$tenant->id.'/sample-events', [
        'lake_id' => $lake->id,
        'station_id' => $station->id,
        'sampled_at' => now()->toDateString(),
        'status' => 'public',
        'measurements' => [ ['parameter_id' => $parameter->id, 'value' => 22.1] ],
    ]);
    $pubAttempt->assertStatus(403);

    // Contributor can create draft
    $draftAttempt = $this->postJson('/api/org/'.$tenant->id.'/sample-events', [
        'lake_id' => $lake->id,
        'station_id' => $station->id,
        'sampled_at' => now()->toDateString(),
        'status' => 'draft',
        'measurements' => [ ['parameter_id' => $parameter->id, 'value' => 23.2] ],
    ]);
    $draftAttempt->assertStatus(201);
    $contribEventId = $draftAttempt->json('data.id');

    // 3. Org admin publishes original event via toggle
    $this->actingAs($orgAdmin);
    $toggleResp = $this->postJson('/api/org/'.$tenant->id.'/sample-events/'.$eventId.'/toggle-publish');
    $toggleResp->assertStatus(200)->assertJsonPath('data.status', 'public');

    // 4. Contributor cannot toggle publish for own draft (expect 403 if status not already public)
    $this->actingAs($contributor);
    $toggleForbidden = $this->postJson('/api/org/'.$tenant->id.'/sample-events/'.$contribEventId.'/toggle-publish');
    $toggleForbidden->assertStatus(403);

    // 5. Org admin updates measurements (replace value) and unpublishes
    $this->actingAs($orgAdmin);
    $updateResp = $this->putJson('/api/org/'.$tenant->id.'/sample-events/'.$eventId, [
        'measurements' => [ ['parameter_id' => $parameter->id, 'value' => 26.0, 'unit' => 'C'] ],
    ]);
    $updateResp->assertStatus(200)->assertJsonPath('data.results_count', 1);
    // Unpublish via toggle
    $unpubResp = $this->postJson('/api/org/'.$tenant->id.'/sample-events/'.$eventId.'/toggle-publish');
    $unpubResp->assertStatus(200)->assertJsonPath('data.status', 'draft');

    // 6. Contributor deletes own draft
    $this->actingAs($contributor);
    $deleteOwn = $this->deleteJson('/api/org/'.$tenant->id.'/sample-events/'.$contribEventId);
    $deleteOwn->assertStatus(200);
    expect(SamplingEvent::find($contribEventId))->toBeNull();

    // Contributor cannot delete org admin's event
    $deleteOthers = $this->deleteJson('/api/org/'.$tenant->id.'/sample-events/'.$eventId);
    $deleteOthers->assertStatus(403);

    // 7. Superadmin can list all events (admin prefix) and delete
    $this->actingAs($super);
    $listResp = $this->getJson('/api/admin/sample-events?organization_id='.$tenant->id);
    $listResp->assertStatus(200);
    $deleteSuper = $this->deleteJson('/api/admin/sample-events/'.$eventId);
    $deleteSuper->assertStatus(200);
    expect(SamplingEvent::find($eventId))->toBeNull();
})->group('water-quality','sampling-events','lifecycle');

// TODO: Add tests for parameter + threshold CRUD & evaluation linkage.
it('superadmin manages parameters and thresholds (CRUD)', function () {
    // Skeleton verifying permission gates only for now.
    $super = superAdmin();
    $this->actingAs($super);
    $paramResp = $this->postJson('/api/admin/parameters', [
        'code' => 'PH', 'name' => 'pH', 'unit' => null, 'evaluation_type' => 'Range'
    ]);
    $paramResp->assertStatus(201);
    $paramId = $paramResp->json('id');
    $showResp = $this->getJson('/api/admin/parameters/'.$paramId);
    $showResp->assertStatus(200);
    $updateResp = $this->putJson('/api/admin/parameters/'.$paramId, [ 'name' => 'pH Updated' ]);
    $updateResp->assertStatus(200)->assertJsonPath('name', 'pH Updated');
    $delResp = $this->deleteJson('/api/admin/parameters/'.$paramId);
    $delResp->assertStatus(200);
})->group('water-quality','parameters')->todo('Expand with threshold creation and evaluation scenarios.');
