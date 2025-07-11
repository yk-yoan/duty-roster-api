import { db } from '@/lib/firebase-admin';
import { resend } from '@/lib/resend';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const logsRef = db.collection('exchangeLogs');

  // 通知されていないログを取得
  const snapshot = await logsRef
    .where('notified', '!=', true)
    .orderBy('notified') // required for inequality filter
    .orderBy('timestamp', 'desc')
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ message: 'No new logs to notify' });
  }

  const logs = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const emailContent = logs
    .map((log: any) => {
      const from = log.fromDoctorName ?? '';
      const to = log.toDoctorName ?? '';
      return log.mode === 'exchange'
        ? `・${log.myDate}（${log.myType}：${from}）⇄ ${log.targetDate}（${log.targetType}：${to}）`
        : `・${log.date}（${log.type}：${from}）→ ${to} に譲渡`;
    })
    .join('<br />');

  try {
    await resend.emails.send({
      from: 'duty-roster@resend.dev',
      to: process.env.NOTIFY_EMAIL as string,
      subject: '＝当直表の更新がありました＝',
      html: `<div style="font-family:sans-serif">
        <h2>＝当直表の更新がありました＝</h2>
        <div>${emailContent}</div>
      </div>`,
    });

    // 通知済みとしてマーク
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { notified: true });
    });
    await batch.commit();

    return NextResponse.json({ message: 'Email sent and logs marked as notified' });
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
