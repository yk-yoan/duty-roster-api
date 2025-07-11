import { NextApiRequest, NextApiResponse } from 'next';
import { resend } from '@/lib/resend';
import { db } from '@/lib/firebase-admin';

interface ExchangeLog {
  mode: 'exchange' | 'transfer';
  myDate?: string;
  myType?: string;
  targetDate?: string;
  targetType?: string;
  date?: string;
  type?: string;
  timestamp: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const logsRef = db.collection('exchangeLogs');

  try {
    const snapshot = await logsRef
      .where('timestamp', '>=', startOfDay.toISOString())
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ message: 'No new logs for today' });
    }

    const logs = snapshot.docs.map(doc => doc.data() as ExchangeLog);

    const emailContent = logs
      .map(log => {
        if (log.mode === 'exchange') {
          return `${log.myDate}(${log.myType}) ⇄ ${log.targetDate}(${log.targetType})`;
        } else if (log.mode === 'transfer') {
          return `${log.date ?? log.myDate}(${log.type}) を譲渡`;
        } else {
          return '不明なログ形式';
        }
      })
      .join('<br />');

    await resend.send({
      from: 'duty-roster@example.com',
      to: process.env.NOTIFY_EMAIL as string,
      subject: '日当直交換ログ通知',
      html: `<div>本日更新されたログ:<br />${emailContent}</div>`,
    });

    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
