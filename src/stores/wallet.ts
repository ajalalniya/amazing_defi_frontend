import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  connector,
  emptyBalances,
  shortenAddress,
  type WalletKind,
} from '@/lib/wallet'

export const useWalletStore = defineStore('wallet', () => {
  const connected = ref(false)
  const address = ref<string | null>(null)
  const wallet = ref<WalletKind | null>(null)
  const chain = ref('—')
  const chainId = ref(0)
  const modalOpen = ref(false)
  const connecting = ref(false)
  const balances = ref(emptyBalances())

  const shortAddress = computed(() => (address.value ? shortenAddress(address.value) : ''))

  connector.setHandlers({
    onAccountsChanged(next) {
      if (!next) {
        connected.value = false
        address.value = null
        wallet.value = null
        balances.value = emptyBalances()
        return
      }
      address.value = next
      void refreshBalances()
    },
    onChainChanged(id, name) {
      chainId.value = id
      chain.value = name
      void refreshBalances()
    },
  })

  async function refreshBalances() {
    if (!address.value || !chainId.value) {
      balances.value = emptyBalances()
      return
    }
    balances.value = await connector.getBalances(address.value, chainId.value)
  }

  async function connect(kind: WalletKind) {
    connecting.value = true
    try {
      const res = await connector.connect(kind)
      connected.value = true
      address.value = res.address
      wallet.value = kind
      chain.value = res.chain
      chainId.value = res.chainId
      modalOpen.value = false
      await refreshBalances()
    } finally {
      connecting.value = false
    }
  }

  async function disconnect() {
    await connector.disconnect()
    connected.value = false
    address.value = null
    wallet.value = null
    chain.value = '—'
    chainId.value = 0
    balances.value = emptyBalances()
  }

  function requestConnect() {
    if (connected.value) {
      void disconnect()
      return
    }
    modalOpen.value = true
  }

  async function sendTx(tx: { to: string; data: string; value: string; chainId: number }) {
    return connector.sendTransaction(tx)
  }

  return {
    connected,
    address,
    wallet,
    chain,
    chainId,
    modalOpen,
    connecting,
    balances,
    shortAddress,
    connect,
    disconnect,
    requestConnect,
    sendTx,
    refreshBalances,
  }
})
