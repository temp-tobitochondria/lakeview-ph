{{--
  Simple plain-text email layout.
  Usage: return $this->text('mail.plain', ['content' => $content]);
--}}
@php
  $appName = 'LakeView PH';
@endphp

{{ strtoupper($appName) }}
------------------------------------------------------------

{!! rtrim($content) !!}

------------------------------------------------------------
This is a system-generated email from {{ $appName }}. Please do not reply to this message.
