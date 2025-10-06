<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\KycProfile;

class KycController extends Controller
{
    public function status(Request $request)
    {
        $u = $request->user();
        $profile = KycProfile::firstOrCreate(['user_id' => $u->id], ['status' => 'draft']);
        return response()->json([
            'data' => [
                'status' => $profile->status,
            ],
        ]);
    }
}
