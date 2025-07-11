// app/api/send-log-summary/route.ts
import { NextResponse } from 'next/server';
import { resend } from '@/lib/resend';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  const today = new Date();
  const snapshot = await db
    .collection('exchangeLogs')
    .where('timestamp', '>=', new Date(today.setHours(0, 0, 0, 0)).toISOString())
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ message: 'No new logs for today' });
  }

  const logs = snapshot.docs.map((doc) => doc.data());

  const emailContent = logs
    .map((log) =>
      log.mode === 'exchange'
        ? `${log.myDate}(${log.myType}) ⇄ ${log.targetDate}(${log.targetType})`
        : `${log.date}(${log.type}) を譲渡`
    )
    .join('<br />');

  try {
    await resend.emails.send({
      from: 'duty-roster@example.com',
      to: process.env.NOTIFY_EMAIL as string,
      subject: '日当直交換ログ通知',
      html: `<div>本日更新されたログ:<br />${emailContent}</div>`,
    });

    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
