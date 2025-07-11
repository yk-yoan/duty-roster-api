// app/api/send-log/route.ts
import { NextResponse } from 'next/server';
import { resend } from '@/lib/resend';

export async function POST(req: Request) {
  try {
    const { subject, html } = await req.json();

    if (!subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: '"onboarding@resend.dev"', // 認証済みドメインのメールアドレスに置き換えてください
      to: ['yukiyoan@gmail.com'], // 通知を受け取るメールアドレス
      subject,
      html,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
