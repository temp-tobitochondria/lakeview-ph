@component('mail::message')
Hi {{ $feedback->is_guest ? ($feedback->guest_name ?: 'there') : ($feedback->user->name ?? 'there') }},

The status of your feedback has been updated.

@component('mail::panel')
Title: {{ $feedback->title ?? 'Feedback' }}

Old status: {{ $oldStatus }}  →  New status: {{ $newStatus }}

@if(!empty($feedback->message))
Message:
{{ $feedback->message }}
@endif
@endcomponent

@component('mail::button', ['url' => config('app.url').'/account/feedback'])
View your feedback
@endcomponent

Thanks,
{{ config('app.name', 'LakeView PH') }}
@endcomponent
