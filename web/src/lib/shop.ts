/**
 * Мінімальна сума замовлення (за товари, до знижки бонусами), у копійках.
 * Має збігатися з MIN_ORDER у functions/src/createOrder.ts — сервер теж перевіряє.
 */
export const MIN_ORDER = 1000_00

/**
 * Чи місто — Львів (тоді можна доставку таксі замість Нової Пошти). Пишуть по-різному: «Львів», «м. Львів», «Lviv»…
 * Має збігатися з isLviv у functions/src/schema.ts — сервер теж перевіряє.
 */
export const isLviv = (city: string) => /льв[іо]в|lviv|lvov|lwów/i.test(city)
