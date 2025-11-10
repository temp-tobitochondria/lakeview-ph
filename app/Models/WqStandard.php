<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WqStandard extends Model
{
    use HasFactory, \App\Support\Audit\Auditable;

    public $timestamps = false;

    protected $fillable = [
        'code',
        'name',
        'is_current',
    ];

    protected $casts = [
        'is_current' => 'boolean',
    ];

    /**
     * Ensure PostgreSQL receives a boolean-friendly literal.
     * Using 'true'/'false' avoids integer 0/1 binding issues under PgBouncer/pgsql.
     */
    public function setIsCurrentAttribute($value): void
    {
        // Normalize a variety of inputs to real boolean first
        $bool = filter_var($value, FILTER_VALIDATE_BOOLEAN);
        // Store as string literal Postgres can implicitly cast to boolean
        $this->attributes['is_current'] = $bool ? 'true' : 'false';
    }

    public function thresholds()
    {
        return $this->hasMany(ParameterThreshold::class, 'standard_id');
    }

    public function samplingEvents()
    {
        return $this->hasMany(SamplingEvent::class, 'applied_standard_id');
    }
}
