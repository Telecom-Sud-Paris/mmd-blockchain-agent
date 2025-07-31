package org.hyperledger.ariesframework.wallet

data class WalletState(
    var walletExistKey: Boolean = false,
    var secretIdKey: String? = null
)