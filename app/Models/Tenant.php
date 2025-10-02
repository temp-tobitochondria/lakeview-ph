<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use HasFactory, SoftDeletes, \App\Support\Audit\Auditable;

    // Deprecated columns removed: domain, metadata
    protected $fillable = ['name', 'type', 'phone', 'address', 'active', 'contact_email', 'slug'];
    protected $casts = ['active' => 'boolean'];

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
