<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $userId = optional($this->route('user'))->id ?? $this->user_id ?? null;

        return [
            'name'       => ['nullable','string','max:255'],
            'email'      => ['required','email','max:255', Rule::unique('users','email')->ignore($userId)],
            'password'   => ['nullable','string','min:8','confirmed'],
            'role'       => ['required', Rule::in(['public','contributor','org_admin','superadmin'])],
            'tenant_id'  => ['nullable','integer','exists:tenants,id'],
        ];
    }

    public function withValidator($v)
    {
        $v->after(function($v){
            $role = $this->input('role');
            $tenantId = $this->input('tenant_id');

            if (in_array($role, ['contributor','org_admin']) && !$tenantId) {
                $v->errors()->add('tenant_id', 'tenant_id is required for org-scoped roles.');
            }
            if ($role === 'superadmin' && $tenantId) {
                $v->errors()->add('tenant_id', 'tenant_id must be null for superadmin.');
            }
        });
    }
}
