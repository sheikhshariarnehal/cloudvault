package com.ndrive.cloudvault.domain.repository

import com.ndrive.cloudvault.domain.model.TelegramConnectionStatus
import com.ndrive.cloudvault.domain.model.TelegramVerifyResult

interface TelegramRepository {
	suspend fun getStatus(): Result<TelegramConnectionStatus>
	suspend fun sendCode(phone: String): Result<Unit>
	suspend fun verifyCode(code: String): Result<TelegramVerifyResult>
	suspend fun verifyPassword(password: String): Result<TelegramVerifyResult>
	suspend fun disconnect(): Result<Unit>
}
