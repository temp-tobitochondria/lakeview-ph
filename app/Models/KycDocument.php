<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KycDocument extends Model
{
    use HasFactory, \App\Support\Audit\Auditable;

    protected $fillable = [
        'user_id',
        'kyc_profile_id',
        'doc_type',
        'storage_path',
        'mime',
        'size_bytes',
        'status',
    ];

    public function profile()
    {
        return $this->belongsTo(KycProfile::class, 'kyc_profile_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
