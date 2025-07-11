import { NextRequest, NextResponse } from 'next/server';
import { resend } from '@/lib/resend';
import { db } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 過去24時間

  const logsRef = db.collection('exchangeLogs');
  const snapshot = await logsRef
    .where('timestamp', '>=', since.toISOString())
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ message: 'No logs updated in the last 24 hours' });
  }

  const logs = snapshot.docs.map(doc => doc.data());

  const emailItems = logs.map(log => {
    if (log.mode === 'exchange') {
      return `
        <li style="margin-bottom: 8px;">
          <strong>${log.myDate}（${log.myType}）</strong> →
          <strong>${log.targetDate}（${log.targetType}）</strong>
        </li>`;
    } else {
      return `
        <li style="margin-bottom: 8px;">
          <strong>${log.date}（${log.type}）</strong> を譲渡
        </li>`;
    }
  }).join('');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; padding: 16px;">
      <h2 style="color: #2c3e50;">＝当直表の更新がありました＝</h2>
      <ul style="padding-left: 1.2em; color: #34495e; font-size: 14px;">
        ${emailItems}
      </ul>
      <p style="font-size: 12px; color: #7f8c8d;">この通知は24時間以内の更新内容をまとめたものです。</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'duty-roster@resend.dev',
      to: process.env.NOTIFY_EMAIL as string,
      subject: '日当直交換ログ通知',
      html: htmlBody,
    });

    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
