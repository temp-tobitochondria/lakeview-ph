<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? 'LakeView PH' }}</title>
    <style>
        /* Basic resets for email clients */
        body { margin:0; padding:0; background:#f4f6f8; color:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, 'Helvetica Neue', Helvetica, sans-serif; }
        a { color:#0ea5e9; text-decoration:none; }
        .wrapper { width:100%; background:#f4f6f8; padding:24px 0; }
        .container { width:100%; max-width:640px; margin:0 auto; background:#ffffff; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.06); overflow:hidden; }
        .header { background:#0f172a; color:#ffffff; padding:18px 24px; font-weight:700; font-size:18px; }
        .accent { height:4px; background:#06b6d4; }
        .content { padding:24px; line-height:1.56; font-size:15px; color:#0f172a; }
        .lead { margin-top:0; }
        .otp-box { display:inline-block; background:#0891b2; color:#ffffff; font-weight:800; letter-spacing:4px; font-size:28px; padding:14px 18px; border-radius:8px; }
        .muted { color:#475569; }
        .footer { text-align:center; color:#64748b; font-size:12px; padding:16px 12px; }
        .divider { height:1px; background:#e2e8f0; margin:8px 0 16px; }
        @media (prefers-color-scheme: dark) {
            body { background:#0b1220; color:#e2e8f0; }
            .wrapper { background:#0b1220; }
            .container { background:#0f172a; box-shadow:0 1px 8px rgba(0,0,0,.35); }
            .content { color:#e2e8f0; }
            .muted { color:#94a3b8; }
            .footer { color:#94a3b8; }
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">{{ $title ?? 'LakeView PH' }}</div>
            <div class="accent"></div>
            <div class="content">
                @yield('content')
                <div class="divider"></div>
                <p class="footer">This is a system-generated email from LakeView PH. Please do not reply to this message.</p>
            </div>
        </div>
        <div class="footer" style="margin-top:12px;">
            &copy; {{ date('Y') }} LakeView PH. All rights reserved.
        </div>
    </div>
</body>
</html>
