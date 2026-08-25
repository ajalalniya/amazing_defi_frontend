import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connector, MOCK_BALANCES, type WalletKind } from '@/lib/wallet'

export const useWalletStore = defineStore('wallet', () => {
  const connected = ref(false)
  const address = ref<string | null>(null)
  const wallet = ref<WalletKind | null>(null)
  const chain = ref('Arbitrum')
  const modalOpen = ref(false)
  const balances = ref({ ...MOCK_BALANCES })

  const shortAddress = computed(() => address.value)

  async function connect(kind: WalletKind) {
    const res = await connector.connect(kind)
    connected.value = true
    address.value = res.address
    wallet.value = kind
    chain.value = res.chain
    modalOpen.value = false
  }

  async function disconnect() {
    await connector.disconnect()
    connected.value = false
    address.value = null
    wallet.value = null
  }

  function requestConnect() {
    if (connected.value) {
      disconnect()
      return
    }
    modalOpen.value = true
  }

  async function sendTx(tx: { to: string; data: string; value: string; chainId: number }) {
    return connector.sendTransaction(tx)
  }

  return { connected, address, wallet, chain, modalOpen, balances, shortAddress, connect, disconnect, requestConnect, sendTx }
})
