import raw from './data/04202/bank.json'
import type { Bank, Item } from './engine/types'

export const bank = raw as unknown as Bank

const images = import.meta.glob('./data/04202/img/*.png', { eager: true, import: 'default' }) as Record<string, string>

export function imageOf(it: Item): string | undefined {
  return it.img ? images[`./data/04202/img/${it.img}`] : undefined
}

export const byId = new Map(bank.items.map((it) => [it.id, it]))

export const KIND_LABEL = { p: '單選', c: '單選', m: '複選' } as const
