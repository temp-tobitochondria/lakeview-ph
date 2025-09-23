<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Models\UserTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class OrgUserController extends Controller
{
    // GET /api/org/{tenant}/users?roles=contributor,org_admin&per_page=15
    public function index(Request $request, int $tenant)
    {
        $roleNames = array_filter(
            array_map('trim', explode(',', (string) $request->query('roles', 'contributor,org_admin')))
        );

        $users = User::query()
            ->whereHas('roles', function ($q) use ($tenant, $roleNames) {
                $q->whereIn('roles.name', $roleNames)
                  ->where('user_tenants.tenant_id', $tenant)
                  ->where('user_tenants.is_active', true);
            })
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15));

        return response()->json($users);
    }

    // GET /api/org/{tenant}/users/{user}
    public function show(Request $request, int $tenant, User $user)
    {
        $this->authorize('manageTenantUser', [$user, $tenant]);

        $user->load(['roles' => function ($q) use ($tenant) {
            $q->where('user_tenants.tenant_id', $tenant);
        }]);

        return response()->json($user);
    }

    // POST /api/org/{tenant}/users
    public function store(Request $request, int $tenant)
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'max:255'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $user = User::firstWhere('email', $data['email']);
        if (! $user) {
            $user = new User([
                'name'  => $data['name'],
                'email' => $data['email'],
            ]);
            $user->password = Hash::make($data['password'] ?? str()->random(16));
            $user->save();
        }

        $roleId = Role::where('name', 'contributor')->value('id');
        if (! $roleId) {
            return response()->json(['message' => 'Role "contributor" not found. Seed roles first.'], 422);
        }

        $this->authorize('manageTenantUser', [$user, $tenant]);

        UserTenant::firstOrCreate(
            ['user_id' => $user->id, 'tenant_id' => $tenant, 'role_id' => $roleId],
            ['is_active' => true]
        );

        return response()->json([
            'message' => 'User added to organization as contributor.',
            'user'    => $user,
        ], 201);
    }

    // PUT /api/org/{tenant}/users/{user}
    public function update(Request $request, int $tenant, User $user)
    {
        $this->authorize('manageTenantUser', [$user, $tenant]);

        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:255'],
            'email'     => ['sometimes', 'email', 'max:255', Rule::unique('users','email')->ignore($user->id)],
            'password'  => ['sometimes', 'nullable', 'string', 'min:8'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('name', $data))  $user->name  = $data['name'];
        if (array_key_exists('email', $data)) $user->email = $data['email'];
        if (!empty($data['password']))        $user->password = Hash::make($data['password']);
        $user->save();

        if (array_key_exists('is_active', $data)) {
            UserTenant::where('user_id', $user->id)
                ->where('tenant_id', $tenant)
                ->update(['is_active' => (bool) $data['is_active']]);
        }

        return response()->json(['message' => 'Updated', 'user' => $user]);
    }

    // DELETE /api/org/{tenant}/users/{user}
    public function destroy(Request $request, int $tenant, User $user)
    {
        $this->authorize('manageTenantUser', [$user, $tenant]);

        UserTenant::where('user_id', $user->id)
            ->where('tenant_id', $tenant)
            ->delete();

        return response()->json(['message' => 'Membership removed']);
    }
}
