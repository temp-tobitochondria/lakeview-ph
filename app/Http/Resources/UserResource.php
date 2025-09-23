<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Determine global role (tenant_id = null) if roles are loaded
        $globalRole = null;
        if ($this->relationLoaded('roles')) {
            $g = $this->roles->first(function ($r) {
                return optional($r->pivot)->tenant_id === null;
            });
            $globalRole = $g->name ?? null;
        }

        return [
            'id'                => $this->id,
            'name'              => $this->name,
            'email'             => $this->email,
            'email_verified_at' => optional($this->email_verified_at)->toIso8601String(),
            'created_at'        => optional($this->created_at)->toIso8601String(),
            'updated_at'        => optional($this->updated_at)->toIso8601String(),
            'global_role'       => $globalRole,
            // expose roles so the editor modal can read pivots too
            'roles' => $this->when($this->relationLoaded('roles'), function () {
                return $this->roles->map(function ($r) {
                    return [
                        'name'       => $r->name,
                        'tenant_id'  => optional($r->pivot)->tenant_id,
                        'is_active'  => (bool) optional($r->pivot)->is_active,
                    ];
                });
            }),
        ];
    }
}
