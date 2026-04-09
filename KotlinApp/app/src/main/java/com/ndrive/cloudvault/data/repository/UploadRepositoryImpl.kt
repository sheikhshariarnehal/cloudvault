package com.ndrive.cloudvault.data.repository

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.ndrive.cloudvault.BuildConfig
import com.ndrive.cloudvault.domain.model.UploadPhase
import com.ndrive.cloudvault.domain.model.UploadState
import com.ndrive.cloudvault.domain.repository.UploadRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import java.io.IOException
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.roundToLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
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
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Singleton
class UploadRepositoryImpl @Inject constructor(
	@ApplicationContext private val appContext: Context,
	private val supabaseClient: SupabaseClient,
	private val okHttpClient: OkHttpClient,
) : UploadRepository {

	override fun uploadFile(fileUri: Uri, folderId: String?): Flow<UploadState> = flow {
		emit(UploadState.InProgress(UploadPhase.PREPARING, 2, 0, 0))

		val userId = resolveCurrentUserId()
			?: throw IllegalStateException("No active session found. Please sign in again.")

		val fileMeta = resolveFileMeta(fileUri)
		emit(UploadState.InProgress(UploadPhase.PREPARING, 6, 0, fileMeta.sizeBytes))

		val storageType = resolveStorageType(userId)
		if (storageType != "user") {
			throw IllegalStateException(
				"Connect your Telegram number in Profile before uploading. " +
				"This ensures files are stored in your own Telegram account."
			)
		}
		val uploadId = initUploadSession(fileMeta, storageType, userId)

		uploadChunks(fileUri, uploadId, fileMeta) { uploadedBytes ->
			val chunkFraction = if (fileMeta.sizeBytes > 0) {
				uploadedBytes.toDouble() / fileMeta.sizeBytes.toDouble()
			} else {
				0.0
			}
			val stagedLoaded = (fileMeta.sizeBytes.toDouble() * chunkFraction * (CHUNK_PHASE_WEIGHT / 100.0))
				.roundToLong()
			val progress = (chunkFraction * CHUNK_PHASE_WEIGHT).roundToInt().coerceIn(0, CHUNK_PHASE_WEIGHT)

			emit(
				UploadState.InProgress(
					phase = UploadPhase.CHUNKS,
					progressPercent = progress,
					uploadedBytes = stagedLoaded,
					totalBytes = fileMeta.sizeBytes,
				)
			)
		}

		val jobId = startCompleteJob(uploadId)
		pollCompleteStatus(jobId, fileMeta.sizeBytes) { telegramProgress ->
			val normalized = telegramProgress.coerceIn(0.0, 1.0)
			val weightedPercent = CHUNK_PHASE_WEIGHT + (normalized * TELEGRAM_PHASE_WEIGHT).roundToInt()
			val stagedLoaded = (
				fileMeta.sizeBytes.toDouble() *
				((CHUNK_PHASE_WEIGHT + normalized * TELEGRAM_PHASE_WEIGHT) / 100.0)
			).roundToLong().coerceIn(0L, fileMeta.sizeBytes)

			emit(
				UploadState.InProgress(
					phase = UploadPhase.TELEGRAM,
					progressPercent = weightedPercent.coerceIn(CHUNK_PHASE_WEIGHT, 98),
					uploadedBytes = stagedLoaded,
					totalBytes = fileMeta.sizeBytes,
				)
			)
		}

		emit(
			UploadState.InProgress(
				phase = UploadPhase.FINALIZING,
				progressPercent = 99,
				uploadedBytes = (fileMeta.sizeBytes * 0.99).roundToLong(),
				totalBytes = fileMeta.sizeBytes,
			)
		)

		val completeResult = awaitCompleteResult(jobId)
		if (completeResult.sessionExpired) {
			markUserTelegramDisconnected(userId)
		}

		val insertedFile = insertFileRecord(
			userId = userId,
			folderId = folderId,
			fileMeta = fileMeta,
			completeResult = completeResult,
			storageType = storageType,
		)

		runCatching {
			resolveAndPersistThumbnail(
				fileId = insertedFile.id,
				userId = userId,
				fileMeta = fileMeta,
				completeResult = completeResult,
				storageType = storageType,
			)
		}

		emit(
			UploadState.Success(
				fileId = insertedFile.id,
				fileName = insertedFile.name,
			)
		)
	}
		.catch { err ->
			val backendErr = err as? BackendRequestException
			emit(
				UploadState.Error(
					message = backendErr?.message ?: err.message ?: "Upload failed",
					retryAfterSeconds = backendErr?.retryAfterSeconds,
				)
			)
		}
		.flowOn(Dispatchers.IO)

	private suspend fun resolveCurrentUserId(): String? {
		supabaseClient.auth.awaitInitialization()
		supabaseClient.auth.currentUserOrNull()?.id?.let { return it }
		supabaseClient.auth.currentSessionOrNull()?.user?.id?.let { return it }
		return runCatching {
			supabaseClient.auth.retrieveUserForCurrentSession(updateSession = true).id
		}.getOrNull()
	}

	private suspend fun resolveStorageType(userId: String): String {
		return runCatching {
			val row = supabaseClient
				.from("users")
				.select(columns = Columns.list("telegram_connected")) {
					filter {
						eq("id", userId)
					}
					limit(1)
				}
				.decodeSingle<TelegramStatusRow>()

			if (row.telegramConnected) "user" else "bot"
		}.getOrDefault("bot")
	}

	private fun initUploadSession(
		fileMeta: LocalFileMeta,
		storageType: String,
		userId: String,
	): String {
		val payload = buildJsonObject {
			put("fileName", fileMeta.displayName)
			put("fileSize", fileMeta.sizeBytes)
			put("mimeType", fileMeta.mimeType)
			put("totalChunks", fileMeta.totalChunks)
			put("storageType", storageType)
			put("userId", userId)
		}

		val request = Request.Builder()
			.url("${tdlibBaseUrl()}/api/chunked-upload/init")
			.applyApiKeyHeader()
			.post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
			.build()

		okHttpClient.newCall(request).execute().use { response ->
			val body = response.body?.string().orEmpty()
			if (!response.isSuccessful) {
				throw parseBackendException(response.code, body, response.header("Retry-After"))
			}

			val root = parseJsonObject(body)
			return root["uploadId"]?.jsonPrimitive?.contentOrNull
				?: throw IOException("Backend did not return uploadId")
		}
	}

	private suspend fun uploadChunks(
		fileUri: Uri,
		uploadId: String,
		fileMeta: LocalFileMeta,
		onChunkProgress: suspend (uploadedBytes: Long) -> Unit,
	) {
		val resolver = appContext.contentResolver
		val input = resolver.openInputStream(fileUri)
			?: throw IOException("Unable to open selected file")

		input.use { stream ->
			val buffer = ByteArray(CHUNK_SIZE_BYTES)
			var uploadedBytes = 0L
			var chunkIndex = 0

			while (true) {
				val read = stream.read(buffer)
				if (read <= 0) break

				val chunkBody = buffer.copyOf(read).toRequestBody(OCTET_STREAM_MEDIA_TYPE)
				val multipart = MultipartBody.Builder()
					.setType(MultipartBody.FORM)
					.addFormDataPart("chunk", "chunk_$chunkIndex", chunkBody)
					.addFormDataPart("uploadId", uploadId)
					.addFormDataPart("chunkIndex", chunkIndex.toString())
					.build()

				val request = Request.Builder()
					.url("${tdlibBaseUrl()}/api/chunked-upload/chunk")
					.applyApiKeyHeader()
					.post(multipart)
					.build()

				okHttpClient.newCall(request).execute().use { response ->
					val body = response.body?.string().orEmpty()
					if (!response.isSuccessful) {
						throw parseBackendException(response.code, body, response.header("Retry-After"))
					}
				}

				uploadedBytes += read
				onChunkProgress(uploadedBytes.coerceAtMost(fileMeta.sizeBytes))
				chunkIndex += 1
			}

			if (chunkIndex != fileMeta.totalChunks) {
				throw IOException("Chunk upload did not finish properly (${chunkIndex}/${fileMeta.totalChunks})")
			}
		}
	}

	private fun startCompleteJob(uploadId: String): String {
		val payload = buildJsonObject {
			put("uploadId", uploadId)
		}

		val request = Request.Builder()
			.url("${tdlibBaseUrl()}/api/chunked-upload/complete-start")
			.applyApiKeyHeader(required = true)
			.post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
			.build()

		okHttpClient.newCall(request).execute().use { response ->
			val body = response.body?.string().orEmpty()
			if (!response.isSuccessful) {
				throw parseBackendException(response.code, body, response.header("Retry-After"))
			}

			val root = parseJsonObject(body)
			return root["jobId"]?.jsonPrimitive?.contentOrNull
				?: throw IOException("Backend did not return jobId")
		}
	}

	private suspend fun pollCompleteStatus(
		jobId: String,
		totalBytes: Long,
		onTelegramProgress: suspend (progress: Double) -> Unit,
	) {
		val encodedJobId = URLEncoder.encode(jobId, StandardCharsets.UTF_8.name())
		val startTimeMs = System.currentTimeMillis()
		var lastProgress = 0.0

		while (true) {
			val request = Request.Builder()
				.url("${tdlibBaseUrl()}/api/chunked-upload/complete-status?jobId=$encodedJobId&t=${System.currentTimeMillis()}")
				.applyApiKeyHeader(required = true)
				.get()
				.build()

			okHttpClient.newCall(request).execute().use { response ->
				val body = response.body?.string().orEmpty()
				if (!response.isSuccessful) {
					throw parseBackendException(response.code, body, response.header("Retry-After"))
				}

				val status = parseStatusResponse(body)
				when (status.state.lowercase()) {
					"failed" -> {
						throw parseBackendException(
							status = 500,
							rawBody = buildJsonObject {
								put("error", status.error ?: "Telegram upload failed")
							}.toString(),
							retryAfterHeader = null,
						)
					}
					"success" -> {
						onTelegramProgress(1.0)
						return
					}
					else -> {
						val bytesProgress = if (status.telegramUploadedBytes != null && totalBytes > 0) {
							status.telegramUploadedBytes.toDouble() / totalBytes.toDouble()
						} else {
							null
						}

						val nextProgress = max(
							status.telegramProgress ?: 0.0,
							bytesProgress ?: 0.0,
						).coerceIn(0.0, 1.0)

						lastProgress = max(lastProgress, nextProgress)
						onTelegramProgress(lastProgress)
					}
				}
			}

			if (System.currentTimeMillis() - startTimeMs > COMPLETE_TIMEOUT_MS) {
				throw IOException("Timed out while waiting for Telegram upload completion")
			}

			delay(COMPLETE_STATUS_POLL_MS)
		}
	}

	private suspend fun awaitCompleteResult(jobId: String): CompleteResult {
		val encodedJobId = URLEncoder.encode(jobId, StandardCharsets.UTF_8.name())
		val startTimeMs = System.currentTimeMillis()

		while (true) {
			val request = Request.Builder()
				.url("${tdlibBaseUrl()}/api/chunked-upload/complete-result?jobId=$encodedJobId")
				.applyApiKeyHeader(required = true)
				.get()
				.build()

			okHttpClient.newCall(request).execute().use { response ->
				val body = response.body?.string().orEmpty()
				if (response.code == 202) {
					// Final result is not ready yet.
				} else if (!response.isSuccessful) {
					throw parseBackendException(response.code, body, response.header("Retry-After"))
				} else {
					return parseCompleteResult(body)
				}
			}

			if (System.currentTimeMillis() - startTimeMs > COMPLETE_TIMEOUT_MS) {
				throw IOException("Timed out while finalizing upload")
			}

			delay(COMPLETE_RESULT_POLL_MS)
		}
	}

	private suspend fun insertFileRecord(
		userId: String,
		folderId: String?,
		fileMeta: LocalFileMeta,
		completeResult: CompleteResult,
		storageType: String,
	): InsertedFileRow {
		val payload = buildJsonObject {
			put("user_id", userId)
			if (folderId.isNullOrBlank()) put("folder_id", JsonNull) else put("folder_id", folderId)
			put("name", fileMeta.displayName)
			put("original_name", fileMeta.displayName)
			put("mime_type", fileMeta.mimeType)
			put("size_bytes", fileMeta.sizeBytes)
			put("telegram_file_id", completeResult.fileId)
			put("telegram_message_id", completeResult.messageId)
			if (completeResult.tdlibFileId == null) put("tdlib_file_id", JsonNull) else put("tdlib_file_id", completeResult.tdlibFileId)
			put("thumbnail_url", JsonNull)
			put("file_hash", JsonNull)
			put("storage_type", completeResult.storageType ?: storageType)
			if (completeResult.chatId == null) put("telegram_chat_id", JsonNull) else put("telegram_chat_id", completeResult.chatId)
		}

		return supabaseClient
			.from("files")
			.insert(payload) {
				select(columns = Columns.list("id", "name"))
			}
			.decodeSingle<InsertedFileRow>()
	}

	private suspend fun resolveAndPersistThumbnail(
		fileId: String,
		userId: String,
		fileMeta: LocalFileMeta,
		completeResult: CompleteResult,
		storageType: String,
	) {
		if (!isThumbnailEligible(fileMeta.mimeType)) return

		val chatId = completeResult.chatId ?: return
		val finalStorageType = completeResult.storageType ?: storageType

		repeat(THUMBNAIL_MAX_ATTEMPTS) { attempt ->
			val r2Url = requestThumbnailR2Url(
				fileId = fileId,
				chatId = chatId,
				messageId = completeResult.messageId,
				storageType = finalStorageType,
				userId = userId,
			)

			if (!r2Url.isNullOrBlank()) {
				supabaseClient
					.from("files")
					.update(
						buildJsonObject {
							put("thumbnail_url", r2Url)
						}
					) {
						filter {
							eq("id", fileId)
						}
					}
				return
			}

			if (attempt < THUMBNAIL_MAX_ATTEMPTS - 1) {
				delay(THUMBNAIL_RETRY_DELAY_MS)
			}
		}
	}

	private fun requestThumbnailR2Url(
		fileId: String,
		chatId: Long,
		messageId: Long,
		storageType: String,
		userId: String,
	): String? {
		val payload = buildJsonObject {
			put("chat_id", chatId)
			put("message_id", messageId)
			put("file_id", fileId)
			put("storage_type", storageType)
			put("user_id", userId)
		}

		val request = Request.Builder()
			.url("${tdlibBaseUrl()}/api/thumbnail/from-message")
			.applyApiKeyHeader(required = true)
			.post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
			.build()

		okHttpClient.newCall(request).execute().use { response ->
			if (!response.isSuccessful) {
				return null
			}

			val body = response.body?.string().orEmpty()
			val root = parseJsonObject(body)
			return root["r2_url"]?.jsonPrimitive?.contentOrNull
		}
	}

	private fun isThumbnailEligible(mimeType: String): Boolean {
		return mimeType.startsWith("image/") || mimeType.startsWith("video/")
	}

	private suspend fun markUserTelegramDisconnected(userId: String) {
		runCatching {
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
	}

	private fun resolveFileMeta(uri: Uri): LocalFileMeta {
		val resolver = appContext.contentResolver
		var displayName: String? = null
		var sizeBytes: Long? = null

		resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
			?.use { cursor ->
				if (cursor.moveToFirst()) {
					val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
					if (nameIndex >= 0) displayName = cursor.getString(nameIndex)

					val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
					if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
						sizeBytes = cursor.getLong(sizeIndex)
					}
				}
			}

		val finalName = displayName ?: "upload_${System.currentTimeMillis()}"
		val finalSize = sizeBytes ?: throw IllegalArgumentException("Unable to determine file size for $finalName")
		if (finalSize <= 0) {
			throw IllegalArgumentException("Selected file is empty")
		}

		val mimeType = resolver.getType(uri) ?: "application/octet-stream"
		val totalChunks = ceil(finalSize.toDouble() / CHUNK_SIZE_BYTES.toDouble()).toInt().coerceAtLeast(1)

		return LocalFileMeta(
			displayName = finalName,
			sizeBytes = finalSize,
			mimeType = mimeType,
			totalChunks = totalChunks,
		)
	}

	private fun parseStatusResponse(rawBody: String): CompleteStatus {
		val root = parseJsonObject(rawBody)
		return CompleteStatus(
			state = root["state"]?.jsonPrimitive?.contentOrNull ?: "uploading",
			telegramProgress = root["telegramProgress"]?.jsonPrimitive?.contentOrNull?.toDoubleOrNull(),
			telegramUploadedBytes = root["telegramUploadedBytes"]?.jsonPrimitive?.contentOrNull?.toLongOrNull(),
			error = root["error"]?.jsonPrimitive?.contentOrNull,
		)
	}

	private fun parseCompleteResult(rawBody: String): CompleteResult {
		val root = parseJsonObject(rawBody)
		val fileId = root["file_id"]?.jsonPrimitive?.contentOrNull
			?: throw IOException("Missing file_id in complete result")
		val messageId = root["message_id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()
			?: throw IOException("Missing message_id in complete result")

		return CompleteResult(
			fileId = fileId,
			messageId = messageId,
			tdlibFileId = root["tdlib_file_id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull(),
			storageType = root["storage_type"]?.jsonPrimitive?.contentOrNull,
			chatId = root["chat_id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull(),
			sessionExpired = root["session_expired"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: false,
		)
	}

	private fun parseBackendException(
		status: Int,
		rawBody: String,
		retryAfterHeader: String?,
	): BackendRequestException {
		var message = when (status) {
			401 -> "Backend authentication failed (missing API key)."
			403 -> "Backend authentication failed (invalid API key)."
			404 -> "Upload session not found or expired."
			429 -> "Rate limited by Telegram. Please retry shortly."
			else -> "Backend request failed with status $status"
		}

		var retryAfter = parseRetryAfterSeconds(retryAfterHeader)

		runCatching {
			val root = parseJsonObject(rawBody)
			root["error"]?.jsonPrimitive?.contentOrNull?.let { backendMessage ->
				if (backendMessage.isNotBlank()) {
					message = backendMessage
				}
			}
			val payloadRetryAfter = root["retry_after"]?.jsonPrimitive?.contentOrNull
			retryAfter = parseRetryAfterSeconds(payloadRetryAfter) ?: retryAfter
		}

		retryAfter = retryAfter ?: parseRetryAfterSeconds(message)
		return BackendRequestException(message = message, retryAfterSeconds = retryAfter)
	}

	private fun parseRetryAfterSeconds(value: String?): Int? {
		if (value.isNullOrBlank()) return null
		value.toIntOrNull()?.let { if (it > 0) return it }

		val retryMatch = RETRY_AFTER_REGEX.find(value)
		if (retryMatch != null) {
			return retryMatch.groupValues.getOrNull(1)?.toIntOrNull()
		}

		val floodWait = FLOOD_WAIT_REGEX.find(value)
		if (floodWait != null) {
			return floodWait.groupValues.getOrNull(1)?.toIntOrNull()
		}

		return null
	}

	private fun tdlibBaseUrl(): String {
		val raw = BuildConfig.TDLIB_SERVICE_URL.trim()
		return (if (raw.isBlank()) "http://10.0.2.2:3001" else raw).trimEnd('/')
	}

	private fun Request.Builder.applyApiKeyHeader(required: Boolean = false): Request.Builder {
		val apiKey = BuildConfig.TDLIB_SERVICE_API_KEY.trim()
		if (apiKey.isNotBlank()) {
			header("X-API-Key", apiKey)
		} else if (required) {
			throw IllegalStateException(
				"Missing TDLIB_SERVICE_API_KEY in BuildConfig/local.properties. " +
				"Set TDLIB_SERVICE_API_KEY to call protected upload completion endpoints."
			)
		}
		return this
	}

	private fun parseJsonObject(raw: String): JsonObject {
		if (raw.isBlank()) return buildJsonObject { }
		return Json.parseToJsonElement(raw).jsonObject
	}

	private data class LocalFileMeta(
		val displayName: String,
		val sizeBytes: Long,
		val mimeType: String,
		val totalChunks: Int,
	)

	@Serializable
	private data class TelegramStatusRow(
		@SerialName("telegram_connected")
		val telegramConnected: Boolean = false,
	)

	@Serializable
	private data class InsertedFileRow(
		val id: String,
		val name: String,
	)

	private data class CompleteStatus(
		val state: String,
		val telegramProgress: Double?,
		val telegramUploadedBytes: Long?,
		val error: String?,
	)

	private data class CompleteResult(
		val fileId: String,
		val messageId: Long,
		val tdlibFileId: Long?,
		val storageType: String?,
		val chatId: Long?,
		val sessionExpired: Boolean,
	)

	private class BackendRequestException(
		override val message: String,
		val retryAfterSeconds: Int? = null,
	) : IOException(message)

	private companion object {
		private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
		private val OCTET_STREAM_MEDIA_TYPE = "application/octet-stream".toMediaType()

		private const val CHUNK_SIZE_BYTES = 10 * 1024 * 1024
		private const val CHUNK_PHASE_WEIGHT = 82
		private const val TELEGRAM_PHASE_WEIGHT = 16

		private const val COMPLETE_STATUS_POLL_MS = 700L
		private const val COMPLETE_RESULT_POLL_MS = 500L
		private const val COMPLETE_TIMEOUT_MS = 30 * 60 * 1000L
		private const val THUMBNAIL_MAX_ATTEMPTS = 3
		private const val THUMBNAIL_RETRY_DELAY_MS = 5_000L

		private val RETRY_AFTER_REGEX = Regex("retry after\\s+(\\d+)", RegexOption.IGNORE_CASE)
		private val FLOOD_WAIT_REGEX = Regex("FLOOD_WAIT_(\\d+)", RegexOption.IGNORE_CASE)
	}
}
