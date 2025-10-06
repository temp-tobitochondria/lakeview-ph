<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KycProfile extends Model
{
    use HasFactory, \App\Support\Audit\Auditable;

    protected $fillable = [
        'user_id','status','full_name','dob','id_type','id_number','address_line1','address_line2','city','province','postal_code','submitted_at','reviewed_at','reviewer_id','reviewer_notes'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
