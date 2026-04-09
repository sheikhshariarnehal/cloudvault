package com.ndrive.cloudvault.presentation.home

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ndrive.cloudvault.domain.model.DriveFile
import com.ndrive.cloudvault.domain.model.DriveFolder
import com.ndrive.cloudvault.domain.model.UploadPhase
import com.ndrive.cloudvault.domain.model.UploadState
import com.ndrive.cloudvault.domain.repository.FileRepository
import com.ndrive.cloudvault.domain.repository.FolderRepository
import com.ndrive.cloudvault.domain.usecase.UploadFileUseCase
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class UploadItemStatus {
	QUEUED,
	UPLOADING,
	SUCCESS,
	ERROR,
}

data class UploadItemUiState(
	val id: Long,
	val fileName: String,
	val phase: UploadPhase? = null,
	val progressPercent: Int = 0,
	val status: UploadItemStatus = UploadItemStatus.QUEUED,
	val message: String? = null,
	val retryAfterSeconds: Int? = null,
)

data class UploadPanelState(
	val isVisible: Boolean = false,
	val isExpanded: Boolean = true,
	val isRunning: Boolean = false,
	val items: List<UploadItemUiState> = emptyList(),
	val summaryMessage: String? = null,
	val successCount: Int = 0,
	val failedCount: Int = 0,
)

data class HomeUiState(
	val isLoading: Boolean = true,
	val folders: List<DriveFolder> = emptyList(),
	val files: List<DriveFile> = emptyList(),
	val query: String = "",
	val errorMessage: String? = null,
	val uploadPanel: UploadPanelState = UploadPanelState(),
)

@HiltViewModel
class HomeViewModel @Inject constructor(
	@ApplicationContext private val appContext: Context,
	private val fileRepository: FileRepository,
	private val folderRepository: FolderRepository,
	private val uploadFileUseCase: UploadFileUseCase,
) : ViewModel() {

	private val _uiState = MutableStateFlow(HomeUiState())
	val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()
	private var nextUploadId: Long = 1L

	init {
		refresh()
	}

	fun refresh() {
		viewModelScope.launch {
			_uiState.update { it.copy(isLoading = true, errorMessage = null) }

			val foldersDeferred = async { folderRepository.getRootFolders(limit = 20) }
			val filesDeferred = async { fileRepository.getRecentFiles(limit = 60) }

			val folderResult = foldersDeferred.await()
			val fileResult = filesDeferred.await()

			val error = folderResult.exceptionOrNull()?.message
				?: fileResult.exceptionOrNull()?.message

			_uiState.update {
				it.copy(
					isLoading = false,
					folders = folderResult.getOrElse { emptyList() },
					files = fileResult.getOrElse { emptyList() },
					errorMessage = error
				)
			}
		}
	}

	fun updateQuery(query: String) {
		_uiState.update { it.copy(query = query) }
	}

	fun clearError() {
		_uiState.update { it.copy(errorMessage = null) }
	}

	fun clearUploadState() {
		_uiState.update { it.copy(uploadPanel = UploadPanelState()) }
	}

	fun toggleUploadPanelExpanded() {
		_uiState.update { current ->
			val panel = current.uploadPanel
			if (!panel.isVisible) {
				current
			} else {
				current.copy(uploadPanel = panel.copy(isExpanded = !panel.isExpanded))
			}
		}
	}

	fun dismissUploadItem(itemId: Long) {
		_uiState.update { current ->
			val panel = current.uploadPanel
			val item = panel.items.firstOrNull { it.id == itemId } ?: return@update current
			if (item.status == UploadItemStatus.UPLOADING || item.status == UploadItemStatus.QUEUED) {
				return@update current
			}

			val remaining = panel.items.filterNot { it.id == itemId }
			if (remaining.isEmpty() && !panel.isRunning) {
				current.copy(uploadPanel = UploadPanelState())
			} else {
				current.copy(uploadPanel = panel.copy(items = remaining))
			}
		}
	}

	fun uploadFile(fileUri: Uri, folderId: String? = null) {
		uploadFiles(listOf(fileUri), folderId)
	}

	fun uploadFiles(fileUris: List<Uri>, folderId: String? = null) {
		val uploadQueue = fileUris.distinct()
		if (uploadQueue.isEmpty()) return

		val currentPanel = _uiState.value.uploadPanel
		if (currentPanel.isRunning) {
			return
		}

		val queueItems = uploadQueue.map { fileUri ->
			UploadItemUiState(
				id = nextUploadId++,
				fileName = resolveDisplayName(fileUri),
			)
		}

		_uiState.update {
			it.copy(
				uploadPanel = UploadPanelState(
					isVisible = true,
					isExpanded = true,
					isRunning = true,
					items = queueItems,
				),
				errorMessage = null,
			)
		}

		viewModelScope.launch {
			var successCount = 0
			var failedCount = 0

			// Upload selected files one by one to avoid Telegram-side rate-limit spikes.
			queueItems.forEachIndexed { index, item ->
				val fileUri = uploadQueue[index]
				var fileSuccess: UploadState.Success? = null
				var fileError: UploadState.Error? = null

				uploadFileUseCase(fileUri = fileUri, folderId = folderId).collect { state ->
					when (state) {
						is UploadState.InProgress -> {
							updateUploadItem(
								itemId = item.id,
								status = UploadItemStatus.UPLOADING,
								phase = state.phase,
								progressPercent = state.progressPercent.coerceIn(0, 99),
								message = phaseLabel(state.phase),
								retryAfterSeconds = null,
							)
						}
						is UploadState.Success -> {
							fileSuccess = state
						}
						is UploadState.Error -> {
							fileError = state
						}
						UploadState.Idle -> Unit
					}
				}

				if (fileSuccess != null) {
					successCount += 1
					updateUploadItem(
						itemId = item.id,
						status = UploadItemStatus.SUCCESS,
						phase = UploadPhase.FINALIZING,
						progressPercent = 100,
						message = "Uploaded",
						retryAfterSeconds = null,
					)
				} else {
					failedCount += 1
					val errorState = fileError ?: UploadState.Error("Upload failed")
					updateUploadItem(
						itemId = item.id,
						status = UploadItemStatus.ERROR,
						phase = null,
						progressPercent = 0,
						message = errorState.message,
						retryAfterSeconds = errorState.retryAfterSeconds,
					)
				}
			}

			refresh()

			val totalCount = queueItems.size
			val summaryMessage = when {
				failedCount == 0 -> "Uploaded $successCount of $totalCount files."
				successCount == 0 -> "Uploaded 0 of $totalCount files. $failedCount failed."
				else -> "Uploaded $successCount of $totalCount files. $failedCount failed."
			}

			_uiState.update { current ->
				current.copy(
					uploadPanel = current.uploadPanel.copy(
						isVisible = true,
						isExpanded = failedCount > 0,
						isRunning = false,
						summaryMessage = summaryMessage,
						successCount = successCount,
						failedCount = failedCount,
					),
				)
			}
		}
	}

	private fun updateUploadItem(
		itemId: Long,
		status: UploadItemStatus,
		phase: UploadPhase?,
		progressPercent: Int,
		message: String?,
		retryAfterSeconds: Int?,
	) {
		_uiState.update { current ->
			val updatedItems = current.uploadPanel.items.map { item ->
				if (item.id == itemId) {
					item.copy(
						status = status,
						phase = phase,
						progressPercent = progressPercent,
						message = message,
						retryAfterSeconds = retryAfterSeconds,
					)
				} else {
					item
				}
			}

			current.copy(uploadPanel = current.uploadPanel.copy(items = updatedItems, isVisible = true))
		}
	}

	private fun resolveDisplayName(fileUri: Uri): String {
		val resolver = appContext.contentResolver
		val fallbackName = fileUri.lastPathSegment?.substringAfterLast('/')
			?: "file_${System.currentTimeMillis()}"
		var displayName: String? = null

		resolver.query(fileUri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
			?.use { cursor ->
				if (cursor.moveToFirst()) {
					val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
					if (nameIndex >= 0) {
						displayName = cursor.getString(nameIndex)
					}
				}
			}

		return displayName?.takeIf { it.isNotBlank() } ?: fallbackName
	}

	private fun phaseLabel(phase: UploadPhase): String {
		return when (phase) {
			UploadPhase.PREPARING -> "Preparing upload"
			UploadPhase.CHUNKS -> "Uploading chunks"
			UploadPhase.TELEGRAM -> "Uploading to Telegram"
			UploadPhase.FINALIZING -> "Finalizing"
		}
	}

	fun filteredFolders(): List<DriveFolder> {
		val q = _uiState.value.query.trim().lowercase()
		if (q.isBlank()) return _uiState.value.folders
		return _uiState.value.folders.filter { it.name.lowercase().contains(q) }
	}

	fun filteredFiles(): List<DriveFile> {
		val q = _uiState.value.query.trim().lowercase()
		if (q.isBlank()) return _uiState.value.files
		return _uiState.value.files.filter { it.name.lowercase().contains(q) }
	}
}
