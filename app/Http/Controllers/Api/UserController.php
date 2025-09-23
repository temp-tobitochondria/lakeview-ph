<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * GET /api/admin/users
     * Query params: q?, page?, per_page?
     */
    public function index(Request $request)
    {
        $q  = trim((string) $request->query('q', ''));
        $pp = max(1, min((int) $request->query('per_page', 15), 200));

        $qb = User::query()
            ->when($q !== '', function ($w) use ($q) {
                $pattern = "%{$q}%";
                // Postgres ILIKE
                $w->where(function ($x) use ($pattern) {
                    $x->where('name', 'ILIKE', $pattern)
                      ->orWhere('email', 'ILIKE', $pattern);
                });
            })
            ->with(['roles' => function ($q) {
                $q->withPivot(['tenant_id', 'is_active']);
            }])
            ->orderBy('name');

        $paginator = $qb->paginate($pp);

        $paginator->getCollection()->transform(function (User $u) {
            return [
                'id'                => $u->id,
                'name'              => $u->name,
                'email'             => $u->email,
                'role'              => $u->role, // baseline (system)
                'global_role'       => $u->highestRoleName(), // effective for UI
                'email_verified_at' => optional($u->email_verified_at)->toIso8601String(),
                'created_at'        => optional($u->created_at)->toIso8601String(),
                'updated_at'        => optional($u->updated_at)->toIso8601String(),
            ];
        });

        return response()->json($paginator);
    }

    /**
     * GET /api/admin/users/{user}
     */
    public function show(User $user)
    {
        $user->load(['roles' => function ($q) {
            $q->withPivot(['tenant_id', 'is_active']);
        }]);

        return response()->json([
            'data' => [
                'id'          => $user->id,
                'name'        => $user->name,
                'email'       => $user->email,
                'role'        => $user->role,
                'global_role' => $user->highestRoleName(),
                'created_at'  => optional($user->created_at)->toIso8601String(),
                'updated_at'  => optional($user->updated_at)->toIso8601String(),
            ],
        ]);
    }

    /**
     * POST /api/admin/users
     * body: { name?, email, password, password_confirmation, role, tenant_id? }
     */
    public function store(Request $request)
    {
    $allowed = \App\Models\Role::query()->pluck('name')->all();

        $data = $request->validate([
            'name'                  => ['nullable', 'string', 'max:255'],
            'email'                 => ['required', 'email', 'max:255', 'unique:users,email'],
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'role'                  => ['required', Rule::in($allowed)],
            'tenant_id'             => ['nullable', 'integer', 'exists:tenants,id'],
        ]);

        // Validate role scope
        if (in_array($data['role'], ['org_admin', 'contributor']) && empty($data['tenant_id'])) {
            return response()->json(['message' => 'tenant_id is required for org-scoped roles.'], 422);
        }
        if ($data['role'] === 'superadmin' && !empty($data['tenant_id'])) {
            return response()->json(['message' => 'tenant_id must be null for superadmin.'], 422);
        }

    $user = new User();
    $user->name  = $data['name'] ?? strtok($data['email'], '@');
    $user->email = $data['email'];
    $user->password = Hash::make($data['password']);
    // Save the actual selected role
    $user->role = $data['role'];
    $user->save();

        // org-scoped assignment if applicable
        $this->upsertOrgMembership($user, $data['role'], $data['tenant_id'] ?? null);

        return response()->json(['data' => $this->resource($user->fresh(['roles']))], 201);
    }

    /**
     * PUT /api/admin/users/{user}
     * body: { name?, email, password?, password_confirmation?, role, tenant_id? }
     */
    public function update(Request $request, User $user)
    {
    $allowed = \App\Models\Role::query()->pluck('name')->all();

        $data = $request->validate([
            'name'                  => ['nullable', 'string', 'max:255'],
            'email'                 => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password'              => ['nullable', 'string', 'min:8', 'confirmed'],
            'role'                  => ['required', Rule::in($allowed)],
            'tenant_id'             => ['nullable', 'integer', 'exists:tenants,id'],
        ]);

        if (in_array($data['role'], ['org_admin', 'contributor']) && empty($data['tenant_id'])) {
            return response()->json(['message' => 'tenant_id is required for org-scoped roles.'], 422);
        }
        if ($data['role'] === 'superadmin' && !empty($data['tenant_id'])) {
            return response()->json(['message' => 'tenant_id must be null for superadmin.'], 422);
        }

        $oldBaseline = $user->role;

        $user->name  = $data['name'] ?? $user->name;
        $user->email = $data['email'] ?? $user->email;
        if (!empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        // Save the actual selected role
        $user->role = $data['role'];
        $user->save();

        // Upsert org membership for org-scoped roles (does nothing for user/superadmin)
        $this->upsertOrgMembership($user, $data['role'], $data['tenant_id'] ?? null);

        // If baseline changed (e.g., user<->superadmin), revoke tokens so abilities refresh
        if ($oldBaseline !== $user->role) {
            $user->tokens()->delete();
        }

        return response()->json(['data' => $this->resource($user->fresh(['roles']))]);
    }

    /**
     * DELETE /api/admin/users/{user}
     */
    public function destroy(User $user)
    {
        $user->tokens()->delete();
        $user->delete();
        return response()->json([], 204);
    }

    /* ----------------------------------------
     | Helpers
     |-----------------------------------------*/

    private function resource(User $u): array
    {
        return [
            'id'          => $u->id,
            'name'        => $u->name,
            'email'       => $u->email,
            'role'        => $u->role,               // baseline (system)
            'global_role' => $u->highestRoleName(),  // effective UI role
            'created_at'  => optional($u->created_at)->toIso8601String(),
            'updated_at'  => optional($u->updated_at)->toIso8601String(),
        ];
    }

    /**
     * Upsert org-scoped membership for org_admin / contributor.
     * Does nothing for 'user' or 'superadmin'.
     */
    private function upsertOrgMembership(User $user, string $roleName, ?int $tenantId): void
    {
        if (!in_array($roleName, ['org_admin', 'contributor'], true)) {
            return; // only org roles are stored in pivot
        }

        $roleId = Role::query()->where('name', $roleName)->value('id');
        if (!$roleId) {
            // roles table should contain these canonical names
            return;
        }

        DB::table('user_tenants')->updateOrInsert(
            [
                'user_id'   => $user->id,
                'tenant_id' => $tenantId,
                'role_id'   => $roleId,
            ],
            [
                'is_active' => true,
                'updated_at'=> now(),
                'created_at'=> now(),
            ]
        );
    }
}
