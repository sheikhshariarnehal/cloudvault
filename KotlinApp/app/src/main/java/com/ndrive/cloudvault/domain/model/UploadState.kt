package com.ndrive.cloudvault.domain.model

enum class UploadPhase {
	PREPARING,
	CHUNKS,
	TELEGRAM,
	FINALIZING,
}

sealed interface UploadState {
	data object Idle : UploadState

	data class InProgress(
		val phase: UploadPhase,
		val progressPercent: Int,
		val uploadedBytes: Long,
		val totalBytes: Long,
	) : UploadState

	data class Success(
		val fileId: String,
		val fileName: String,
	) : UploadState

	data class Error(
		val message: String,
		val retryAfterSeconds: Int? = null,
	) : UploadState
}
