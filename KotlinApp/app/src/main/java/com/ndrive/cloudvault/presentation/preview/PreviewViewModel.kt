package com.ndrive.cloudvault.presentation.preview

import android.net.Uri
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ndrive.cloudvault.BuildConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import java.io.File
import java.io.IOException
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import kotlin.math.min
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import okhttp3.Request

data class PreviewUiState(
	val isLoading: Boolean = false,
	val isOpening: Boolean = false,
	val isReady: Boolean = false,
	val fileName: String = "",
	val mimeType: String = "application/octet-stream",
	val statusMessage: String? = null,
	val errorMessage: String? = null,
	val openUri: Uri? = null,
)

@HiltViewModel
class PreviewViewModel @Inject constructor(
	@ApplicationContext private val appContext: android.content.Context,
	private val supabaseClient: SupabaseClient,
	private val okHttpClient: OkHttpClient,
) : ViewModel() {

	private val _uiState = MutableStateFlow(PreviewUiState())
	val uiState: StateFlow<PreviewUiState> = _uiState.asStateFlow()

	private var currentFileId: String? = null
	private var cachedFileId: String? = null
	private var cachedUri: Uri? = null
	private var cachedMimeType: String = "application/octet-stream"
	private var cachedName: String = ""
	private var prepareJob: Job? = null

	fun preparePreview(encodedFileId: String, forceReload: Boolean = false) {
		val fileId = Uri.decode(encodedFileId).trim()
		if (fileId.isBlank()) {
			_uiState.update {
				it.copy(
					isLoading = false,
					errorMessage = "Invalid file id.",
					statusMessage = null,
					isReady = false,
					isOpening = false,
					openUri = null,
				)
			}
			return
		}

		currentFileId = fileId

		if (!forceReload && cachedFileId == fileId && cachedUri != null) {
			_uiState.update {
				it.copy(
					isLoading = false,
					isReady = true,
					isOpening = true,
					fileName = cachedName,
					mimeType = cachedMimeType,
					statusMessage = "Opening with your default app...",
					errorMessage = null,
					openUri = cachedUri,
				)
			}
			return
		}

		prepareJob?.cancel()
		prepareJob = viewModelScope.launch {
			_uiState.update {
				it.copy(
					isLoading = true,
					isReady = false,
					isOpening = false,
					statusMessage = "Preparing file preview...",
					errorMessage = null,
					openUri = null,
				)
			}

			runCatching {
				withContext(Dispatchers.IO) {
					supabaseClient.auth.awaitInitialization()

					val file = fetchFileRow(fileId)
					val displayName = file.originalName?.takeIf { it.isNotBlank() } ?: file.name
					val finalMimeType = file.mimeType.ifBlank { "application/octet-stream" }
					val targetFile = downloadFile(file = file, displayName = displayName, mimeType = finalMimeType)

					val uri = FileProvider.getUriForFile(
						appContext,
						"${BuildConfig.APPLICATION_ID}.fileprovider",
						targetFile,
					)

					PreparedPreview(
						uri = uri,
						fileName = displayName,
						mimeType = finalMimeType,
					)
				}
			}.onSuccess { prepared ->
				cachedFileId = fileId
				cachedUri = prepared.uri
				cachedName = prepared.fileName
				cachedMimeType = prepared.mimeType

				_uiState.update {
					it.copy(
						isLoading = false,
						isReady = true,
						isOpening = false,
						fileName = prepared.fileName,
						mimeType = prepared.mimeType,
						statusMessage = "File is ready. Tap 'Open with default app'.",
						errorMessage = null,
						openUri = prepared.uri,
					)
				}
			}.onFailure { error ->
				val message = error.message?.takeIf { it.isNotBlank() } ?: "Failed to prepare this file."
				_uiState.update {
					it.copy(
						isLoading = false,
						isReady = false,
						isOpening = false,
						statusMessage = null,
						errorMessage = message,
						openUri = null,
					)
				}
			}
		}
	}

	fun retry() {
		val fileId = currentFileId ?: return
		preparePreview(encodedFileId = fileId, forceReload = true)
	}

	fun requestOpenAgain() {
		val uri = cachedUri ?: return
		_uiState.update {
			it.copy(
				isOpening = true,
				errorMessage = null,
				statusMessage = "Opening with your default app...",
				openUri = uri,
			)
		}
	}

	fun onOpenHandled() {
		_uiState.update {
			it.copy(
				isOpening = false,
				statusMessage = "Opened in your device app.",
				errorMessage = null,
				openUri = null,
			)
		}
	}

	fun onOpenFailed(message: String) {
		_uiState.update {
			it.copy(
				isOpening = false,
				statusMessage = null,
				errorMessage = message,
				openUri = null,
			)
		}
	}

	private suspend fun fetchFileRow(fileId: String): PreviewFileRow {
		return supabaseClient
			.from("files")
			.select(
				Columns.list(
					"id",
					"name",
					"original_name",
					"mime_type",
					"telegram_file_id",
					"telegram_message_id",
					"storage_type",
					"user_id",
					"is_trashed",
				),
			) {
				filter {
					eq("id", fileId)
					eq("is_trashed", false)
				}
			}
			.decodeSingle<PreviewFileRow>()
	}

	private fun downloadFile(
		file: PreviewFileRow,
		displayName: String,
		mimeType: String,
	): File {
		val apiKey = BuildConfig.TDLIB_SERVICE_API_KEY.trim()
		check(apiKey.isNotBlank()) {
			"Missing TDLIB_SERVICE_API_KEY. Add it to local.properties to enable preview."
		}

		val downloadUrl = buildDownloadUrl(
			file = file,
			displayName = displayName,
			mimeType = mimeType,
		)

		val request = Request.Builder()
			.url(downloadUrl)
			.header("X-API-Key", apiKey)
			.get()
			.build()

		return okHttpClient.newCall(request).execute().use { response ->
			if (!response.isSuccessful) {
				throw IOException("Download failed (${response.code}).")
			}

			val body = response.body ?: throw IOException("Download response was empty.")

			val previewDir = File(appContext.cacheDir, PREVIEW_CACHE_DIR)
			if (!previewDir.exists()) {
				previewDir.mkdirs()
			}

			val outputFile = File(
				previewDir,
				buildOutputFileName(
					fileId = file.id,
					displayName = displayName,
				),
			)

			body.byteStream().use { input ->
				outputFile.outputStream().use { output ->
					input.copyTo(output)
				}
			}

			outputFile
		}
	}

	private fun buildDownloadUrl(
		file: PreviewFileRow,
		displayName: String,
		mimeType: String,
	): String {
		val baseUrl = BuildConfig.TDLIB_SERVICE_URL.trim().ifBlank { DEFAULT_TDLIB_URL }.trimEnd('/')
		val encodedRemoteId = urlEncode(file.telegramFileId)

		val params = mutableListOf(
			"filename=${urlEncode(displayName)}",
			"mime_type=${urlEncode(mimeType)}",
			"inline=true",
			"storage_type=${urlEncode(file.storageType?.ifBlank { "bot" } ?: "bot")}",
		)

		file.telegramMessageId?.let { params += "message_id=$it" }
		if (file.storageType.equals("user", ignoreCase = true) && !file.userId.isNullOrBlank()) {
			params += "user_id=${urlEncode(file.userId)}"
		}

		return "$baseUrl/api/download/$encodedRemoteId?${params.joinToString("&")}" 
	}

	private fun buildOutputFileName(fileId: String, displayName: String): String {
		val cleanId = fileId.replace(Regex("[^A-Za-z0-9_-]"), "").ifBlank { "file" }
		val safeName = displayName
			.replace(Regex("[\\\\/:*?\"<>|]"), "_")
			.replace(Regex("\\s+"), " ")
			.trim()
			.ifBlank { "file" }

		val clipped = safeName.take(MAX_FILENAME_LENGTH)
		val idPrefix = cleanId.take(min(cleanId.length, 12))
		return "${idPrefix}_$clipped"
	}

	private fun urlEncode(value: String): String {
		return URLEncoder.encode(value, StandardCharsets.UTF_8.name())
	}

	@Serializable
	private data class PreviewFileRow(
		val id: String,
		val name: String,
		@SerialName("original_name")
		val originalName: String? = null,
		@SerialName("mime_type")
		val mimeType: String,
		@SerialName("telegram_file_id")
		val telegramFileId: String,
		@SerialName("telegram_message_id")
		val telegramMessageId: Long? = null,
		@SerialName("storage_type")
		val storageType: String? = null,
		@SerialName("user_id")
		val userId: String? = null,
	)

	private data class PreparedPreview(
		val uri: Uri,
		val fileName: String,
		val mimeType: String,
	)

	private companion object {
		private const val PREVIEW_CACHE_DIR = "preview-files"
		private const val MAX_FILENAME_LENGTH = 80
		private const val DEFAULT_TDLIB_URL = "http://10.0.2.2:3001"
	}
}
