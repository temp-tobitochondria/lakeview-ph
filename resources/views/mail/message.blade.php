@extends('mail.layouts.system', ['title' => $title ?? 'LakeView PH Notification'])

@section('content')
    <p class="lead">Hi {{ $name ?? 'there' }},</p>

    @foreach(($lines ?? []) as $line)
        <p>{!! nl2br(e($line)) !!}</p>
    @endforeach

    @if(!empty($signoff))
        <p>{!! nl2br(e($signoff)) !!}</p>
    @endif
@endsection
