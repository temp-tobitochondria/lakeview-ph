<?php

namespace Database\Factories;

use App\Models\Feedback;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Feedback>
 */
class FeedbackFactory extends Factory
{
    protected $model = Feedback::class;

    public function definition(): array
    {
        return [
            'user_id' => null,
            'tenant_id' => null,
            'is_guest' => true,
            'guest_name' => $this->faker->name(),
            'guest_email' => $this->faker->safeEmail(),
            'title' => $this->faker->sentence(4),
            'message' => $this->faker->paragraph(),
            'category' => $this->faker->randomElement(['bug','feature','data','other']),
            'status' => Feedback::STATUS_OPEN,
            'metadata' => ['browser' => 'tests'],
            'admin_response' => null,
            'spam_score' => 0,
            'resolved_at' => null,
        ];
    }
}
