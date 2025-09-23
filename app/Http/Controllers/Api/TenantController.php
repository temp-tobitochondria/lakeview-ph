<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserTenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TenantController extends Controller
{
    /**
     * GET /api/admin/tenants
     * ?q=  (search by name/slug/domain)
     * ?with_deleted=1  (include soft-deleted)
     * ?per_page=15
     */
    public function index(Request $request)
    {
        $q           = trim((string) $request->query('q', ''));
        $perPage     = max(1, min((int) $request->query('per_page', 15), 200));
        $withDeleted = (bool) $request->query('with_deleted', false);

        $qb = Tenant::query()
            ->when($withDeleted, fn($w) => $w->withTrashed())
            ->when($q !== '', function ($w) use ($q) {
                $p = "%{$q}%";
                $w->where(function ($x) use ($p) {
                    $x->where('name', 'ILIKE', $p)
                      ->orWhere('slug', 'ILIKE', $p)
                      ->orWhere('domain', 'ILIKE', $p);
                });
            })
            ->orderBy('name');

        $paginator = $qb->paginate($perPage);

        $paginator->getCollection()->transform(function (Tenant $t) {
            return $this->tenantResource($t);
        });

        return response()->json($paginator);
    }

    /**
     * GET /api/admin/tenants/{tenant}
     */
    public function show(Tenant $tenant)
    {
        return response()->json(['data' => $this->tenantResource($tenant)]);
    }

    /**
     * POST /api/admin/tenants
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255', 'unique:tenants,name'],
            'slug'          => ['nullable', 'string', 'max:255', 'unique:tenants,slug'],
            'domain'        => ['nullable', 'string', 'max:255', 'unique:tenants,domain'],
            'type'          => ['nullable', 'string', 'max:255'],
            'phone'         => ['nullable', 'string', 'max:255'],
            'address'       => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'active'        => ['sometimes', 'boolean'],
            'metadata'      => ['sometimes', 'array'], // JSONB
        ]);

        $tenant = new Tenant();
        $tenant->name          = $data['name'];
        $tenant->slug          = $data['slug']          ?? null;
        $tenant->domain        = $data['domain']        ?? null;
        $tenant->type          = $data['type']          ?? null;
        $tenant->phone         = $data['phone']         ?? null;
        $tenant->address       = $data['address']       ?? null;
        $tenant->contact_email = $data['contact_email'] ?? null;
        $tenant->active        = array_key_exists('active', $data) ? (bool)$data['active'] : true;
        if (array_key_exists('metadata', $data)) {
            $tenant->metadata = $data['metadata'];
        }
        $tenant->save();

        return response()->json(['data' => $this->tenantResource($tenant)], 201);
    }

    /**
     * PUT /api/admin/tenants/{tenant}
     */
    public function update(Request $request, Tenant $tenant)
    {
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255', Rule::unique('tenants', 'name')->ignore($tenant->id)],
            'slug'          => ['nullable', 'string', 'max:255', Rule::unique('tenants', 'slug')->ignore($tenant->id)],
            'domain'        => ['nullable', 'string', 'max:255', Rule::unique('tenants', 'domain')->ignore($tenant->id)],
            'type'          => ['nullable', 'string', 'max:255'],
            'phone'         => ['nullable', 'string', 'max:255'],
            'address'       => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'active'        => ['sometimes', 'boolean'],
            'metadata'      => ['sometimes', 'array'],
        ]);

        $tenant->name          = $data['name'];
        $tenant->slug          = $data['slug']          ?? null;
        $tenant->domain        = $data['domain']        ?? null;
        $tenant->type          = $data['type']          ?? null;
        $tenant->phone         = $data['phone']         ?? null;
        $tenant->address       = $data['address']       ?? null;
        $tenant->contact_email = $data['contact_email'] ?? null;
        if (array_key_exists('active', $data)) {
            $tenant->active = (bool)$data['active'];
        }
        if (array_key_exists('metadata', $data)) {
            $tenant->metadata = $data['metadata'];
        }
        $tenant->save();

        return response()->json(['data' => $this->tenantResource($tenant)]);
    }

    /**
     * DELETE /api/admin/tenants/{tenant}
     * Soft-deletes the tenant.
     */
    public function destroy(Tenant $tenant)
    {
        $tenant->delete();
        return response()->json([], 204);
    }

    /**
     * POST /api/admin/tenants/{id}/restore
     */
    public function restore($id)
    {
        $tenant = Tenant::withTrashed()->findOrFail($id);
        $tenant->restore();
        return response()->json(['data' => $this->tenantResource($tenant)]);
    }

    /* =========================================================================
     | Org Admin management for a tenant (superadmin-only)
     |   GET    /api/admin/tenants/{tenant}/admins
     |   POST   /api/admin/tenants/{tenant}/admins      { user_id }
     |   DELETE /api/admin/tenants/{tenant}/admins/{user}
     * =========================================================================*/

    public function admins(Tenant $tenant)
    {
        $roleId = Role::where('name', 'org_admin')->value('id');
        if (!$roleId) {
            return response()->json(['message' => 'org_admin role missing'], 422);
        }

        $rows = UserTenant::query()
            ->where('tenant_id', $tenant->id)
            ->where('role_id', $roleId)
            ->where('is_active', true)
            ->join('users', 'users.id', '=', 'user_tenants.user_id')
            ->orderBy('users.name')
            ->get([
                'users.id', 'users.name', 'users.email',
                'user_tenants.joined_at', 'user_tenants.is_active'
            ]);

        return response()->json(['data' => $rows]);
    }

    public function assignAdmin(Request $request, Tenant $tenant)
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $roleId = Role::where('name', 'org_admin')->value('id');
        if (!$roleId) {
            return response()->json(['message' => 'org_admin role missing'], 422);
        }

        DB::transaction(function () use ($tenant, $data, $roleId) {
            UserTenant::updateOrCreate(
                [
                    'user_id'   => $data['user_id'],
                    'tenant_id' => $tenant->id,
                    'role_id'   => $roleId,
                ],
                [
                    'is_active' => true,
                    'joined_at' => now(),
                ]
            );
        });

        return response()->json(['message' => 'Org admin assigned']);
    }

    public function removeAdmin(Tenant $tenant, User $user)
    {
        $roleId = Role::where('name', 'org_admin')->value('id');
        if (!$roleId) {
            return response()->json(['message' => 'org_admin role missing'], 422);
        }

        $ut = UserTenant::where([
            'user_id'   => $user->id,
            'tenant_id' => $tenant->id,
            'role_id'   => $roleId,
        ])->first();

        if (!$ut) {
            return response()->json(['message' => 'Not an org admin for this tenant'], 404);
        }

        // Keep audit trail: deactivate instead of delete
        $ut->update(['is_active' => false]);

        return response()->json(['message' => 'Org admin removed']);
    }

    /* ----------------------------------------
     | Resource formatter
     |-----------------------------------------*/
    private function tenantResource(Tenant $t): array
    {
        return [
            'id'            => $t->id,
            'name'          => $t->name,
            'slug'          => $t->slug,
            'domain'        => $t->domain,
            'type'          => $t->type,
            'phone'         => $t->phone,
            'address'       => $t->address,
            'contact_email' => $t->contact_email,
            'active'        => (bool) $t->active,
            'metadata'      => $t->metadata,
            'deleted_at'    => optional($t->deleted_at)->toIso8601String(),
            'created_at'    => optional($t->created_at)->toIso8601String(),
            'updated_at'    => optional($t->updated_at)->toIso8601String(),
        ];
    }
}
