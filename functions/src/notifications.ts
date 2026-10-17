import { logger } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/firestore'
import { defineSecret } from 'firebase-functions/params'
import { runTrigger } from './observability.js'
import type { Order } from './schema.js'

// Задаються командою: firebase functions:secrets:set TELEGRAM_BOT_TOKEN
// Локально — у файлі functions/.secret.local (див. .secret.local.example).
const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
const telegramChatId = defineSecret('TELEGRAM_CHAT_ID')

const PAYMENT_LABELS: Record<Order['payment']['method'], string> = {
  cod: 'Накладений платіж (старе замовлення)',
  card_transfer: 'Передоплата на картку — надіслати реквізити',
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatUah(kopecks: number): string {
  return `${(kopecks / 100).toLocaleString('uk-UA')} грн`
}

export function formatOrderMessage(order: Order): string {
  const d = order.delivery
  const lines = [
    `🌵 <b>Нове замовлення ${escapeHtml(order.number)}</b>`,
    '',
    ...order.items.map((i) => `• ${escapeHtml(i.name.uk)} × ${i.qty} — ${formatUah(i.price * i.qty)}`),
    '',
    ...(order.bonusUsed > 0
      ? [`Сума: ${formatUah(order.subtotal)}`, `Бонусами: −${formatUah(order.bonusUsed)}`]
      : []),
    `<b>До сплати: ${formatUah(order.total)}</b>`,
    `Оплата: ${PAYMENT_LABELS[order.payment.method]}`,
    '',
    `👤 ${escapeHtml(d.fullName)}`,
    `📞 ${escapeHtml(d.phone)}`,
    `✉️ ${escapeHtml(order.email)}`,
    `📦 ${escapeHtml(d.city)}, ${escapeHtml(d.warehouse)}`,
  ]
  if (d.comment) lines.push(`💬 ${escapeHtml(d.comment)}`)
  if (!order.userId) lines.push('', '<i>Гостьове замовлення</i>')
  return lines.join('\n')
}

async function sendTelegram(text: string): Promise<void> {
  const token = telegramBotToken.value()
  const chatId = telegramChatId.value()
  // «-» — заглушка, якою секрети заповнюються при першому деплої, поки бота ще немає.
  if (!token || !chatId || token === '-' || chatId === '-') {
    logger.warn('Telegram is not configured, skipping notification. Message:\n' + text)
    return
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    // Кидаємо помилку, щоб Functions спробували ще раз (retry), якщо Telegram тимчасово недоступний.
    throw new Error(`Telegram API ${res.status}: ${await res.text()}`)
  }
}

export const onOrderCreated = onDocumentCreated(
  { document: 'orders/{orderId}', secrets: [telegramBotToken, telegramChatId] },
  async (event) => {
    const order = event.data?.data() as Order | undefined
    if (!order) return
    await runTrigger('onOrderCreated', { orderId: event.params.orderId, number: order.number, uid: order.userId }, () =>
      sendTelegram(formatOrderMessage(order)),
    )
    // Email продавцю й покупцю — додамо, коли з'явиться домен (Resend + SPF/DKIM).
  },
)
