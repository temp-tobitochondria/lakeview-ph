@component('mail::message')
Hi {{ $feedback->is_guest ? ($feedback->guest_name ?: 'there') : ($feedback->user->name ?? 'there') }},

An administrator has replied to your feedback.

@component('mail::panel')
Title: {{ $feedback->title ?? 'Feedback' }}

Reply:
{{ $reply }}
@endcomponent

@component('mail::button', ['url' => config('app.url').'/account/feedback'])
View your feedback
@endcomponent

Thanks,
{{ config('app.name', 'LakeView PH') }}
@endcomponent
