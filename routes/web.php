<?php

use Illuminate\Support\Facades\Route;

Route::get('/{any}', function () {
    return view('app'); // your main blade file that mounts React
})->where('any', '.*');

