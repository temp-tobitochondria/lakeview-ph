<?php

namespace App\Events;

use App\Models\Feedback;

class FeedbackStatusChanged
{
    public function __construct(
        public Feedback $feedback,
        public string $oldStatus,
        public string $newStatus,
        public ?int $actorId = null,
    ) {}
}
