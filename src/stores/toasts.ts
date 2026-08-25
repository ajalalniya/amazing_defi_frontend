import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Toast = { id: number; title: string; sub?: string; kind?: 'err' }

export const useToastStore = defineStore('toasts', () => {
  const items = ref<Toast[]>([])
  let seq = 0

  function push(title: string, sub?: string, kind?: 'err') {
    const id = ++seq
    items.value.push({ id, title, sub, kind })
    setTimeout(() => {
      items.value = items.value.filter((t) => t.id !== id)
    }, 3800)
  }

  return { items, push }
})
