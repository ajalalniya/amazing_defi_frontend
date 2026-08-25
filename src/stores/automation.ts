import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Phase 2 surface — own store, not bolted onto portfolio. */
export type AutomationJob = {
  id: string
  owner: string
  strategy: string
  paused: boolean
}

export type AutomationRun = {
  id: string
  jobId: string
  at: string
  kind: 'evaluation' | 'execution'
  fired: boolean
  reason: string
  txHash?: string
  outcome?: string
}

export const useAutomationStore = defineStore('automation', () => {
  const jobs = ref<AutomationJob[]>([])
  const runs = ref<Record<string, AutomationRun[]>>({})

  async function load(_owner: string) {
    jobs.value = []
  }

  return { jobs, runs, load }
})
