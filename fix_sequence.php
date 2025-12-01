<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Fix users sequence
DB::statement("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));");

echo "✓ Users sequence has been reset successfully!\n";
