<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserTenant extends Model
{
    protected $fillable = ['user_id','tenant_id','role_id','joined_at','is_active'];

    public function user()   { return $this->belongsTo(User::class); }
    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function role()   { return $this->belongsTo(Role::class); }
}
