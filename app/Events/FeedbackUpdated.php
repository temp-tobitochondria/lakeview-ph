<?php

namespace App\Events;

use App\Models\Feedback;

class FeedbackUpdated
{
    public function __construct(
        public Feedback $feedback,
        public ?string $oldStatus,
        public ?string $newStatus,
        public ?string $oldReply,
        public ?string $newReply,
        public ?int $actorId = null,
    ) {}
}
