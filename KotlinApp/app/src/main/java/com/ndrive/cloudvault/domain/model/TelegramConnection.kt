package com.ndrive.cloudvault.domain.model

data class TelegramConnectionStatus(
	val connected: Boolean,
	val phone: String? = null,
	val telegramUserId: Long? = null,
)

enum class TelegramVerifyState {
	READY,
	PASSWORD_REQUIRED,
}

data class TelegramVerifyResult(
	val state: TelegramVerifyState,
	val phone: String? = null,
	val telegramUserId: Long? = null,
)
