<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\Expression;

class Feedback extends Model
{
    use HasFactory; // enable model factories for tests
    use \App\Support\Audit\Auditable;
    protected $table = 'feedback';

    protected $fillable = [
        'user_id','tenant_id','lake_id','title','message','category','status','metadata','images','admin_response','resolved_at',
        'is_guest','guest_name','guest_email','spam_score'
    ];

    protected $casts = [
        'metadata' => 'array',
        'images' => 'array',
        'resolved_at' => 'datetime',
        'is_guest' => 'boolean',
        'spam_score' => 'integer',
    ];

    // Ensure Postgres receives true/false instead of integer 1/0 literals (avoids 42804 datatype mismatch)
    public function setIsGuestAttribute($value): void
    {
        // For Postgres we want literal true/false in SQL, not integer 1/0.
        // Using an Expression avoids parameter binding converting boolean to integer.
        $bool = $value ? true : false;
        // If the connection driver is pgsql, use raw boolean literals.
        try {
            $driver = config('database.default');
            $connName = $driver;
            $driverName = config("database.connections.$connName.driver");
            if ($driverName === 'pgsql') {
                $this->attributes['is_guest'] = new Expression($bool ? 'true' : 'false');
                return;
            }
        } catch (\Throwable $e) { /* fallback below */ }
        // Fallback for other drivers (SQLite/MySQL) – normal boolean acceptable.
        $this->attributes['is_guest'] = $bool;
    }

    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_WONT_FIX = 'wont_fix';
    public const ALL_STATUSES = [
        self::STATUS_OPEN,
        self::STATUS_IN_PROGRESS,
        self::STATUS_RESOLVED,
        self::STATUS_WONT_FIX,
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function lake(): BelongsTo { return $this->belongsTo(Lake::class); }

    public function getSubmitterNameAttribute(): string
    {
        if ($this->is_guest) {
            return $this->guest_name ?: 'Guest';
        }
        return $this->user?->name ?? 'User';
    }
}
