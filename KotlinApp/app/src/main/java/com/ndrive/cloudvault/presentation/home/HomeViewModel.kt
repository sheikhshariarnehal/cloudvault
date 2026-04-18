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
import com.ndrive.cloudvault.domain.repository.TelegramRepository
import com.ndrive.cloudvault.domain.usecase.UploadFileUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
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
    val showTelegramConnectPrompt: Boolean = false,
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val fileRepository: FileRepository,
    private val folderRepository: FolderRepository,
    private val telegramRepository: TelegramRepository,
    private val uploadFileUseCase: UploadFileUseCase,
    private val uploadPanelStore: UploadPanelStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()
    private var nextUploadId: Long = 1L

    init {
        observeUploadPanel()
        refresh()
    }

    private fun observeUploadPanel() {
        viewModelScope.launch {
            uploadPanelStore.state.collect { panel ->
                _uiState.update { it.copy(uploadPanel = panel) }
            }
        }
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
                    errorMessage = error,
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

    fun dismissTelegramConnectPrompt() {
        _uiState.update { it.copy(showTelegramConnectPrompt = false) }
    }

    fun clearUploadState() {
        uploadPanelStore.clearAll()
    }

    fun toggleUploadPanelExpanded() {
        uploadPanelStore.toggleExpanded()
    }

    fun dismissUploadItem(itemId: Long) {
        uploadPanelStore.dismissItem(itemId)
    }

    fun createFolder(name: String) {
        val trimmedName = name.trim()
        if (trimmedName.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Folder name cannot be empty") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(errorMessage = null) }
            folderRepository.createFolder(name = trimmedName, parentId = null)
                .onSuccess { refresh() }
                .onFailure { error ->
                    _uiState.update { current ->
                        current.copy(errorMessage = error.message ?: "Unable to create folder")
                    }
                }
        }
    }

    fun uploadFile(fileUri: Uri, folderId: String? = null) {
        uploadFiles(listOf(fileUri), folderId)
    }

    fun uploadFiles(fileUris: List<Uri>, folderId: String? = null) {
        val uploadQueue = fileUris
            .map { it.toString() to it }
            .distinctBy { it.first }
            .map { it.second }

        if (uploadQueue.isEmpty()) return
        if (uploadPanelStore.state.value.isRunning) return

        viewModelScope.launch {
            _uiState.update { it.copy(showTelegramConnectPrompt = false) }

            val telegramConnected = telegramRepository.getStatus()
                .getOrNull()
                ?.connected

            if (telegramConnected == false) {
                _uiState.update { it.copy(showTelegramConnectPrompt = true) }
                return@launch
            }

            val queueItems = uploadQueue.map { fileUri ->
                UploadItemUiState(
                    id = nextUploadId++,
                    fileName = resolveDisplayName(fileUri),
                )
            }

            uploadPanelStore.startQueue(queueItems)

            var successCount = 0
            var failedCount = 0

            // Upload files sequentially to keep progress predictable and avoid backend spikes.
            for (index in queueItems.indices) {
                val item = queueItems[index]
                val fileUri = uploadQueue[index]
                var fileSuccess: UploadState.Success? = null
                var fileError: UploadState.Error? = null

                uploadFileUseCase(fileUri = fileUri, folderId = folderId).collect { state ->
                    when (state) {
                        is UploadState.InProgress -> {
                            uploadPanelStore.updateItem(
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
                    uploadPanelStore.updateItem(
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
                    val needsTelegramConnect = isTelegramConnectionRequiredError(errorState.message)
                    uploadPanelStore.updateItem(
                        itemId = item.id,
                        status = UploadItemStatus.ERROR,
                        phase = null,
                        progressPercent = 0,
                        message = if (needsTelegramConnect) {
                            TELEGRAM_CONNECT_REQUIRED_MESSAGE
                        } else {
                            errorState.message
                        },
                        retryAfterSeconds = errorState.retryAfterSeconds,
                    )

                    if (needsTelegramConnect) {
                        _uiState.update { it.copy(showTelegramConnectPrompt = true) }

                        for (remainingItem in queueItems.drop(index + 1)) {
                            uploadPanelStore.updateItem(
                                itemId = remainingItem.id,
                                status = UploadItemStatus.ERROR,
                                phase = null,
                                progressPercent = 0,
                                message = TELEGRAM_CONNECT_SKIPPED_MESSAGE,
                                retryAfterSeconds = null,
                            )
                            failedCount += 1
                        }
                        break
                    }
                }
            }

            refresh()
            uploadPanelStore.finishQueue(
                successCount = successCount,
                failedCount = failedCount,
                totalCount = queueItems.size,
            )
        }
    }

    private fun isTelegramConnectionRequiredError(message: String?): Boolean {
        val normalized = message?.lowercase() ?: return false
        return normalized.contains("connect your telegram number") ||
            normalized.contains("connect telegram")
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

    companion object {
        private const val TELEGRAM_CONNECT_REQUIRED_MESSAGE = "Connect Telegram to continue uploads."
        private const val TELEGRAM_CONNECT_SKIPPED_MESSAGE = "Upload skipped. Connect Telegram first."
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