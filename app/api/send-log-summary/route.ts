import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { resend } from '@/lib/resend';

export async function GET(req: NextRequest) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // ログを取得（当日以降の更新のみ）
    const logsSnapshot = await db
      .collection('exchangeLogs')
      .where('timestamp', '>=', today.toISOString())
      .get();

    if (logsSnapshot.empty) {
      return NextResponse.json({ message: 'No logs today' });
    }

    const logs = logsSnapshot.docs.map((doc) => doc.data());

    // 医師情報をマッピング
    const doctorIds = Array.from(
      new Set([
        ...logs.map((log) => log.fromDoctorId),
        ...logs.map((log) => log.toDoctorId),
      ])
    ).filter(Boolean);

    const doctorSnapshots = await Promise.all(
      doctorIds.map((id) => db.collection('doctors').doc(id).get())
    );

    const doctorMap = new Map<string, string>();
    doctorSnapshots.forEach((doc) => {
      if (doc.exists) {
        doctorMap.set(doc.id, doc.data()?.name || '不明');
      }
    });

    // メール本文生成
    const emailItems = logs.map((log) => {
      const fromName = doctorMap.get(log.fromDoctorId) ?? '不明';
      const toName = doctorMap.get(log.toDoctorId) ?? '不明';

      if (log.mode === 'exchange') {
        return `<li>${log.myDate} ${log.myType}（${fromName}） ⇨ ${log.targetType}（${toName}）</li>`;
      } else {
        return `<li>${log.date} ${log.type}（${fromName}） ⇨ 譲渡（${toName}）</li>`;
      }
    });

    const emailHtml = `
      <div>
        <strong>＝当直表の更新がありました＝</strong><br /><br />
        <ul>
          ${emailItems.join('')}
        </ul>
      </div>
    `;

    // メール送信
    await resend.emails.send({
      from: 'duty-roster@resend.dev',
      to: process.env.NOTIFY_EMAIL as string,
      subject: '日当直交換ログ通知',
      html: emailHtml,
    });

    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('送信エラー:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
