<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Event;
use App\Events\FeedbackStatusChanged;
use App\Events\FeedbackAdminReplied;
use App\Listeners\SendFeedbackStatusChangedEmail;
use App\Listeners\SendFeedbackAdminReplyEmail;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\URL;
use App\Models\Lake;
use App\Models\Watershed;
use App\Models\User;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Ensure generated URLs and asset() links use HTTPS in production behind a proxy (e.g., Render)
        // This prevents mixed-content issues when the app can't detect the forwarded scheme.
        if (config('app.env') === 'production' && filter_var(env('FORCE_HTTPS', true), FILTER_VALIDATE_BOOLEAN)) {
            URL::forceScheme('https');
        }

        Relation::enforceMorphMap([
        'lake'      => Lake::class,
        'watershed' => Watershed::class,
        'user' => User::class
        // add more when you support other bodies
    ]);

        // Register event listeners
        Event::listen(FeedbackStatusChanged::class, [SendFeedbackStatusChangedEmail::class, 'handle']);
        Event::listen(FeedbackAdminReplied::class, [SendFeedbackAdminReplyEmail::class, 'handle']);
    }
}
