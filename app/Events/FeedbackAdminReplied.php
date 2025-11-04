<?php

namespace App\Events;

use App\Models\Feedback;

class FeedbackAdminReplied
{
    public function __construct(
        public Feedback $feedback,
        public ?string $oldReply,
        public ?string $newReply,
        public ?int $actorId = null,
    ) {}
}
