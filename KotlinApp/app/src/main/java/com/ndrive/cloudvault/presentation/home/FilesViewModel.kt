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

data class FilesUiState(
        val isLoading: Boolean = true,
        val files: List<DriveFile> = emptyList(),
        val folders: List<DriveFolder> = emptyList(),
        val errorMessage: String? = null
)

@HiltViewModel
class FilesViewModel @Inject constructor(
        private val fileRepository: FileRepository,
        private val folderRepository: FolderRepository
) : ViewModel() {

        private companion object {
                const val ROOT_ITEMS_LIMIT = 200
        }

        private val _uiState = MutableStateFlow(FilesUiState())
        val uiState: StateFlow<FilesUiState> = _uiState.asStateFlow()

        init {
                refresh()
        }

        fun refresh() {
                viewModelScope.launch {
                        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

                        val filesDeferred = async { fileRepository.getRootFiles(limit = ROOT_ITEMS_LIMIT) }
                        val foldersDeferred = async { folderRepository.getRootFolders(limit = ROOT_ITEMS_LIMIT) }

                        val filesResult = filesDeferred.await()
                        val foldersResult = foldersDeferred.await()

                        val hasError = filesResult.isFailure || foldersResult.isFailure

                        _uiState.update {
                                it.copy(
                                        isLoading = false,
                                        files = filesResult.getOrNull() ?: emptyList(),
                                        folders = foldersResult.getOrNull() ?: emptyList(),
                                        errorMessage = if (hasError) "Failed to load files or folders." else null
                                )
                        }
                }
        }
}
