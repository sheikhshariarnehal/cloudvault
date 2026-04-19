package com.ndrive.cloudvault.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ndrive.cloudvault.domain.model.DriveFile
import com.ndrive.cloudvault.domain.model.DriveFolder
import com.ndrive.cloudvault.domain.repository.FileRepository
import com.ndrive.cloudvault.domain.repository.FolderRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class FolderBreadcrumb(
    val id: String?,
    val name: String,
)

data class FolderUiState(
    val isLoading: Boolean = true,
    val currentFolder: DriveFolder? = null,
    val breadcrumbs: List<FolderBreadcrumb> = listOf(FolderBreadcrumb(id = null, name = "My Drive")),
    val folders: List<DriveFolder> = emptyList(),
    val files: List<DriveFile> = emptyList(),
    val errorMessage: String? = null,
)

@HiltViewModel
class FolderViewModel @Inject constructor(
    private val fileRepository: FileRepository,
    private val folderRepository: FolderRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(FolderUiState())
    val uiState: StateFlow<FolderUiState> = _uiState.asStateFlow()

    private var activeFolderId: String? = null

    fun loadFolder(folderId: String) {
        if (folderId.isBlank()) return
        activeFolderId = folderId

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            val currentFolderResult = folderRepository.getFolderById(folderId)
            val currentFolder = currentFolderResult.getOrNull()

            if (currentFolder == null) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        currentFolder = null,
                        breadcrumbs = listOf(FolderBreadcrumb(id = null, name = "My Drive")),
                        folders = emptyList(),
                        files = emptyList(),
                        errorMessage = currentFolderResult.exceptionOrNull()?.message ?: "Folder not found",
                    )
                }
                return@launch
            }

            val childFoldersDeferred = async { folderRepository.getFoldersByParentId(parentId = folderId, limit = 100) }
            val filesDeferred = async { fileRepository.getFilesByFolderId(folderId = folderId, limit = 200) }
            val breadcrumbsDeferred = async { buildBreadcrumbs(currentFolder) }

            val childFoldersResult = childFoldersDeferred.await()
            val filesResult = filesDeferred.await()
            val breadcrumbs = breadcrumbsDeferred.await()

            val errorMessage = childFoldersResult.exceptionOrNull()?.message
                ?: filesResult.exceptionOrNull()?.message

            _uiState.update {
                it.copy(
                    isLoading = false,
                    currentFolder = currentFolder,
                    breadcrumbs = breadcrumbs,
                    folders = childFoldersResult.getOrElse { emptyList() },
                    files = filesResult.getOrElse { emptyList() },
                    errorMessage = errorMessage,
                )
            }
        }
    }

    fun refresh() {
        activeFolderId?.let { loadFolder(it) }
    }

    private suspend fun buildBreadcrumbs(folder: DriveFolder): List<FolderBreadcrumb> {
        val chain = mutableListOf<DriveFolder>()
        val seen = mutableSetOf<String>()

        var current: DriveFolder? = folder
        while (current != null && seen.add(current.id)) {
            chain.add(current)
            val parentId = current.parentId ?: break
            current = folderRepository.getFolderById(parentId).getOrNull()
        }

        val folderCrumbs = chain
            .asReversed()
            .map { FolderBreadcrumb(id = it.id, name = it.name) }

        return listOf(FolderBreadcrumb(id = null, name = "My Drive")) + folderCrumbs
    }
}
