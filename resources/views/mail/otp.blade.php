@php
    $greeting = isset($name) && trim($name) !== '' ? "Hi {$name}," : 'Dear User,';
@endphp

@extends('mail.layouts.system', ['title' => $title ?? 'Email OTP'])

@section('content')
    <p class="lead">{{ $greeting }}</p>

    <p>Your One-Time Password (OTP) is:</p>

    <p>
        <span class="otp-box">{{ $code }}</span>
    </p>

    <p class="muted">Please use this OTP to complete your {{ $purpose ?? 'login' }} process. Do not share this code with anyone.</p>
    @if(!empty($ttlMinutes))
        <p class="muted">This code will expire in {{ $ttlMinutes }} minutes.</p>
    @endif

    <p>Thank you for using LakeView PH!</p>
@endsection
