package com.ndrive.cloudvault.data.repository

import com.ndrive.cloudvault.BuildConfig
import com.ndrive.cloudvault.domain.model.TelegramConnectionStatus
import com.ndrive.cloudvault.domain.model.TelegramVerifyResult
import com.ndrive.cloudvault.domain.model.TelegramVerifyState
import com.ndrive.cloudvault.domain.repository.TelegramRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import java.io.IOException
import java.time.Instant
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Singleton
class TelegramRepositoryImpl @Inject constructor(
	private val supabaseClient: SupabaseClient,
	private val okHttpClient: OkHttpClient,
) : TelegramRepository {

	override suspend fun getStatus(): Result<TelegramConnectionStatus> = withContext(Dispatchers.IO) {
		runCatching {
			val userId = resolveCurrentUserId() ?: throw IllegalStateException("No active session found. Please sign in again.")
			val dbStatus = getDbStatus(userId)

			if (dbStatus.connected) {
				val backendStatus = fetchBackendStatus(userId)
				if (backendStatus == null) {
					return@runCatching dbStatus
				}

				if (backendStatus.connected) {
					return@runCatching dbStatus.copy(
						telegramUserId = backendStatus.telegramUserId ?: dbStatus.telegramUserId,
					)
				}

				delay(1200)
				val retryStatus = fetchBackendStatus(userId)
				if (retryStatus == null || retryStatus.connected) {
					return@runCatching dbStatus
				}

				clearTelegramFields(userId)
				return@runCatching TelegramConnectionStatus(connected = false)
			}

			val backendStatus = fetchBackendStatus(userId)
			if (backendStatus?.connected == true) {
				persistConnectedState(
					userId = userId,
					phone = dbStatus.phone,
					telegramUserId = backendStatus.telegramUserId,
				)
				return@runCatching TelegramConnectionStatus(
					connected = true,
					phone = dbStatus.phone,
					telegramUserId = backendStatus.telegramUserId,
				)
			}

			TelegramConnectionStatus(connected = false)
		}
	}

	override suspend fun sendCode(phone: String): Result<Unit> = withContext(Dispatchers.IO) {
		runCatching {
			val userId = resolveCurrentUserId() ?: throw IllegalStateException("No active session found. Please sign in again.")
			val normalizedPhone = normalizePhone(phone)

			val payload = buildJsonObject {
				put("userId", userId)
				put("phone", normalizedPhone)
			}
			postJson("/api/telegram/send-code", payload)
			Unit
		}
	}

	override suspend fun verifyCode(code: String): Result<TelegramVerifyResult> = withContext(Dispatchers.IO) {
		runCatching {
			val userId = resolveCurrentUserId() ?: throw IllegalStateException("No active session found. Please sign in again.")
			val normalizedCode = code.filter(Char::isDigit)
			if (normalizedCode.length !in 4..8) {
				throw IllegalArgumentException("Invalid code format")
			}

			val payload = buildJsonObject {
				put("userId", userId)
				put("code", normalizedCode)
			}

			val data = postJson("/api/telegram/verify-code", payload)
			val status = data["status"]?.jsonPrimitive?.contentOrNull
			val phone = data["phone"]?.jsonPrimitive?.contentOrNull
			val telegramUserId = data["telegramUserId"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()

			return@runCatching when (status) {
				"password_required" -> {
					TelegramVerifyResult(state = TelegramVerifyState.PASSWORD_REQUIRED)
				}
				"ready" -> {
					persistConnectedState(userId, phone, telegramUserId)
					TelegramVerifyResult(
						state = TelegramVerifyState.READY,
						phone = phone,
						telegramUserId = telegramUserId,
					)
				}
				else -> throw IllegalStateException("Unexpected Telegram response")
			}
		}
	}

	override suspend fun verifyPassword(password: String): Result<TelegramVerifyResult> = withContext(Dispatchers.IO) {
		runCatching {
			val userId = resolveCurrentUserId() ?: throw IllegalStateException("No active session found. Please sign in again.")
			if (password.isBlank()) {
				throw IllegalArgumentException("Password required")
			}

			val payload = buildJsonObject {
				put("userId", userId)
				put("password", password)
			}

			val data = postJson("/api/telegram/verify-password", payload)
			val status = data["status"]?.jsonPrimitive?.contentOrNull
			val phone = data["phone"]?.jsonPrimitive?.contentOrNull
			val telegramUserId = data["telegramUserId"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()

			if (status != "ready") {
				throw IllegalStateException("Unexpected Telegram response")
			}

			persistConnectedState(userId, phone, telegramUserId)
			TelegramVerifyResult(
				state = TelegramVerifyState.READY,
				phone = phone,
				telegramUserId = telegramUserId,
			)
		}
	}

	override suspend fun disconnect(): Result<Unit> = withContext(Dispatchers.IO) {
		runCatching {
			val userId = resolveCurrentUserId() ?: throw IllegalStateException("No active session found. Please sign in again.")
			val payload = buildJsonObject { put("userId", userId) }

			runCatching {
				postJson("/api/telegram/disconnect", payload)
			}
			clearTelegramFields(userId)
		}
	}

	private suspend fun getDbStatus(userId: String): TelegramConnectionStatus {
		val rows = supabaseClient
			.from("users")
			.select(columns = Columns.list("telegram_connected", "telegram_phone", "telegram_user_id")) {
				filter {
					eq("id", userId)
				}
				limit(1)
			}
			.decodeList<TelegramDbRow>()

		val row = rows.firstOrNull() ?: return TelegramConnectionStatus(connected = false)
		return TelegramConnectionStatus(
			connected = row.telegramConnected,
			phone = row.telegramPhone,
			telegramUserId = row.telegramUserId,
		)
	}

	private suspend fun clearTelegramFields(userId: String) {
		supabaseClient
			.from("users")
			.update(
				buildJsonObject {
					put("telegram_connected", false)
					put("telegram_phone", JsonNull)
					put("telegram_user_id", JsonNull)
					put("telegram_connected_at", JsonNull)
				}
			) {
				filter {
					eq("id", userId)
				}
			}
	}

	private suspend fun persistConnectedState(
		userId: String,
		phone: String?,
		telegramUserId: Long?,
	) {
		supabaseClient
			.from("users")
			.update(
				buildJsonObject {
					put("telegram_connected", true)
					if (phone.isNullOrBlank()) put("telegram_phone", JsonNull) else put("telegram_phone", phone)
					if (telegramUserId == null) put("telegram_user_id", JsonNull) else put("telegram_user_id", telegramUserId)
					put("telegram_connected_at", Instant.now().toString())
				}
			) {
				filter {
					eq("id", userId)
				}
			}
	}

	private fun fetchBackendStatus(userId: String): BackendStatusResponse? {
		val encodedUserId = URLEncoder.encode(userId, StandardCharsets.UTF_8.name())
		val request = Request.Builder()
			.url("${tdlibBaseUrl()}/api/telegram/status/$encodedUserId")
			.applyApiKeyHeader(required = true)
			.get()
			.build()

		return runCatching {
			okHttpClient.newCall(request).execute().use { response ->
				if (!response.isSuccessful) {
					return@use null
				}
				val body = response.body?.string().orEmpty()
				val root = parseJsonObject(body)
				BackendStatusResponse(
					connected = root["connected"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: false,
					telegramUserId = root["telegramUserId"]?.jsonPrimitive?.contentOrNull?.toLongOrNull(),
				)
			}
		}.getOrNull()
	}

	private fun postJson(path: String, payload: JsonObject): JsonObject {
		val request = Request.Builder()
			.url("${tdlibBaseUrl()}$path")
			.applyApiKeyHeader(required = true)
			.post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
			.build()

		okHttpClient.newCall(request).execute().use { response ->
			val body = response.body?.string().orEmpty()
			if (!response.isSuccessful) {
				throw parseBackendException(response.code, body)
			}
			return parseJsonObject(body)
		}
	}

	private suspend fun resolveCurrentUserId(): String? {
		supabaseClient.auth.awaitInitialization()
		supabaseClient.auth.currentUserOrNull()?.id?.let { return it }
		supabaseClient.auth.currentSessionOrNull()?.user?.id?.let { return it }
		return runCatching {
			supabaseClient.auth.retrieveUserForCurrentSession(updateSession = true).id
		}.getOrNull()
	}

	private fun normalizePhone(phone: String): String {
		val cleanPhone = phone.trim().replace(Regex("[\\s\\-()]"), "")
		if (!Regex("^\\+\\d{7,15}$").matches(cleanPhone)) {
			throw IllegalArgumentException("Invalid phone number format. Use international format: +1234567890")
		}
		return cleanPhone
	}

	private fun parseBackendException(status: Int, rawBody: String): IOException {
		val messageFromBody = runCatching {
			parseJsonObject(rawBody)["error"]?.jsonPrimitive?.contentOrNull
		}.getOrNull()

		val message = messageFromBody?.takeIf { it.isNotBlank() } ?: when (status) {
			400 -> "Invalid Telegram request"
			401 -> "Unauthorized"
			403 -> "Invalid backend API key"
			429 -> "Too many attempts. Please wait and try again."
			503 -> "Telegram service is unavailable. Please try again later."
			else -> "Telegram request failed with status $status"
		}
		return IOException(message)
	}

	private fun tdlibBaseUrl(): String {
		val raw = BuildConfig.TDLIB_SERVICE_URL.trim()
		return (if (raw.isBlank()) "http://10.0.2.2:3001" else raw).trimEnd('/')
	}

	private fun Request.Builder.applyApiKeyHeader(required: Boolean): Request.Builder {
		val apiKey = BuildConfig.TDLIB_SERVICE_API_KEY.trim()
		if (apiKey.isNotBlank()) {
			header("X-API-Key", apiKey)
		} else if (required) {
			throw IllegalStateException(
				"Missing TDLIB_SERVICE_API_KEY in local.properties for Telegram verification endpoints."
			)
		}
		return this
	}

	private fun parseJsonObject(raw: String): JsonObject {
		if (raw.isBlank()) return buildJsonObject {}
		return Json.parseToJsonElement(raw).jsonObject
	}

	@Serializable
	private data class TelegramDbRow(
		@SerialName("telegram_connected")
		val telegramConnected: Boolean = false,
		@SerialName("telegram_phone")
		val telegramPhone: String? = null,
		@SerialName("telegram_user_id")
		val telegramUserId: Long? = null,
	)

	private data class BackendStatusResponse(
		val connected: Boolean,
		val telegramUserId: Long?,
	)

	private companion object {
		private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
	}
}
