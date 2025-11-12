<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class OrgApplicationDecision extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $status,
        public ?string $notes = null,
        public ?string $tenantName = null
    ) {}

    public function build()
    {
        $name = 'there';
        try {
            $full = (string) ($this->user->name ?? '');
            if (trim($full) !== '') {
                $parts = preg_split('/\s+/', trim($full));
                if ($parts && strlen($parts[0])) $name = $parts[0];
            }
        } catch (\Throwable $e) {}

        $org = $this->tenantName ?: 'the organization';

        // Normalize status keys
        $statusKey = strtolower($this->status);
        $statusKey = match ($statusKey) {
            'approved', 'accept', 'accepted' => 'approved',
            'needs_changes', 'need_changes', 'needs-change', 'need-change' => 'needs_changes',
            'rejected', 'reject' => 'rejected',
            default => $statusKey,
        };

        // Build per-status subject and content
        $subject = '🌊 LakeView PH — Your Organization Application Update';
        $lines = [];
        $plain = [];

        // Common intro
        $intro = "We’ve reviewed your organization application to {$org}, and here’s the result:";

        if ($statusKey === 'approved') {
            $subject = '🌊 LakeView PH — Your Organization Application Has Been Approved';
            $lines[] = $intro;
            $lines[] = 'Status: Approved ✅';
            if ($this->notes) {
                $lines[] = "Notes from the reviewer:\n{$this->notes}";
            }
            $lines[] = 'You can now accept the invitation by visiting the "Join an Org" tab.';
            $lines[] = 'Thank you for taking the time to apply.';
            $lines[] = 'We appreciate your interest in contributing to the LakeView PH community.';
            $lines[] = 'Wishing you clear skies and calm waters,';

            $plain = [
                "Application Update",
                "Hi {$name},",
                $intro,
                'Status: Approved ✅',
                $this->notes ? "Notes from the reviewer:\n{$this->notes}" : null,
                'You can now accept the invitation by visiting the "Join an Org" tab.',
                'Thank you for taking the time to apply.',
                'We appreciate your interest in contributing to the LakeView PH community.',
                'Wishing you clear skies and calm waters,',
                '— LakeView PH',
            ];
        } elseif ($statusKey === 'rejected') {
            $subject = '🌊 LakeView PH — Update on Your Organization Application';
            $lines[] = $intro;
            $lines[] = 'Status: Rejected ❌';
            $lines[] = 'Notes from the reviewer:';
            $lines[] = $this->notes ? $this->notes : 'Unfortunately, your application did not meet the current requirements.';
            $lines[] = 'If you believe this decision was made in error, you may send a petition or appeal to bantaylawa.ph@gmail.com.';
            $lines[] = 'Thank you for your effort and understanding.';
            $lines[] = 'Wishing you clear skies and calm waters,';

            $plain = [
                "Application Update",
                "Hi {$name},",
                $intro,
                'Status: Rejected ❌',
                'Notes from the reviewer:',
                $this->notes ? $this->notes : 'Unfortunately, your application did not meet the current requirements.',
                'If you believe this decision was made in error, you may send a petition or appeal to bantaylawa.ph@gmail.com.',
                'Thank you for your effort and understanding.',
                'Wishing you clear skies and calm waters,',
                '— LakeView PH',
            ];
        } elseif ($statusKey === 'needs_changes') {
            $subject = '🌊 LakeView PH — Action Needed: Organization Application Update';
            $lines[] = $intro;
            $lines[] = 'Status: Needs Changes ✏️';
            $lines[] = 'Notes from the reviewer:';
            $lines[] = $this->notes ? $this->notes : 'Some information or documents need your attention before we can proceed.';
            $lines[] = 'Please review and update your details in the "Organization Applications" section of your account to ensure all information and documents are correct.';
            $lines[] = 'Thank you for your prompt attention to this matter.';
            $lines[] = 'Wishing you clear skies and calm waters,';

            $plain = [
                "Application Update",
                "Hi {$name},",
                $intro,
                'Status: Needs Changes ✏️',
                'Notes from the reviewer:',
                $this->notes ? $this->notes : 'Some information or documents need your attention before we can proceed.',
                'Please review and update your details in the "Organization Applications" section of your account to ensure all information and documents are correct.',
                'Thank you for your prompt attention to this matter.',
                'Wishing you clear skies and calm waters,',
                '— LakeView PH',
            ];
        } else {
            // Fallback generic
            $map = [
                'approved' => 'Approved',
                'needs_changes' => 'Needs Changes',
                'rejected' => 'Rejected',
            ];
            $state = $map[$statusKey] ?? ucfirst($statusKey);
            $subject = '🌊 LakeView PH — Your Organization Application Update';
            $lines = [
                $intro,
                "Status: {$state}" . ($this->notes ? "\n\nNotes from the reviewer: {$this->notes}" : ''),
                'Thank you for taking the time to apply.',
                'We appreciate your interest in contributing to the LakeView PH community.',
                'Wishing you clear skies and calm waters,',
            ];
            $plain = [
                "Application Update",
                "Hi {$name},",
                $intro,
                "Status: {$state}",
                $this->notes ? "Notes from the reviewer:\n{$this->notes}" : null,
                'Thank you for taking the time to apply.',
                'We appreciate your interest in contributing to the LakeView PH community.',
                'Wishing you clear skies and calm waters,',
                '— LakeView PH',
            ];
        }

        // Compose plain content from lines, skipping nulls
        $plainContent = implode("\n\n", array_values(array_filter($plain, fn($l) => $l !== null && $l !== '')));

        return $this->subject($subject)
            ->view('mail.message', [
                'title' => 'Application Update',
                'name' => $name,
                'lines' => $lines,
                'signoff' => '— LakeView PH'
            ])
            ->text('mail.plain', [
                'content' => $plainContent,
            ]);
    }
}
