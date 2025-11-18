<?php

return [
    // Limit CORS processing to API routes and Sanctum cookie route
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    // Allow the frontend origin(s) set via env; use comma-separated list
    'allowed_origins' => array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '*')))),

    // Patterns (kept empty when using explicit origins above)
    'allowed_origins_patterns' => [],

    // Typical headers browsers send for JSON/multipart requests
    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization', 'Accept', 'Origin'],

    // Methods needed by the app
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Expose no special headers
    'exposed_headers' => [],

    // Preflight cache
    'max_age' => 3600,

    // API is token-based; no credentials needed for guest feedback
    'supports_credentials' => false,
];
