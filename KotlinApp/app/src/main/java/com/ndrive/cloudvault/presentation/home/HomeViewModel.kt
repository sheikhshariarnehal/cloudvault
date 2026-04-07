package com.ndrive.cloudvault.presentation.home

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ndrive.cloudvault.domain.model.DriveFile
import com.ndrive.cloudvault.domain.model.DriveFolder
import com.ndrive.cloudvault.domain.model.UploadState
import com.ndrive.cloudvault.domain.repository.FileRepository
import com.ndrive.cloudvault.domain.repository.FolderRepository
import com.ndrive.cloudvault.domain.usecase.UploadFileUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
	val isLoading: Boolean = true,
	val folders: List<DriveFolder> = emptyList(),
	val files: List<DriveFile> = emptyList(),
	val query: String = "",
	val errorMessage: String? = null,
	val uploadState: UploadState = UploadState.Idle,
)

@HiltViewModel
class HomeViewModel @Inject constructor(
	private val fileRepository: FileRepository,
	private val folderRepository: FolderRepository,
	private val uploadFileUseCase: UploadFileUseCase,
) : ViewModel() {

	private val _uiState = MutableStateFlow(HomeUiState())
	val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

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
		_uiState.update { it.copy(uploadState = UploadState.Idle) }
	}

	fun uploadFile(fileUri: Uri, folderId: String? = null) {
		val currentUploadState = _uiState.value.uploadState
		if (currentUploadState is UploadState.InProgress) {
			return
		}

		viewModelScope.launch {
			uploadFileUseCase(fileUri = fileUri, folderId = folderId).collect { state ->
				_uiState.update { it.copy(uploadState = state, errorMessage = null) }

				if (state is UploadState.Success) {
					refresh()
					delay(1200)
					_uiState.update { latest ->
						if (latest.uploadState is UploadState.Success) {
							latest.copy(uploadState = UploadState.Idle)
						} else {
							latest
						}
					}
				}
			}
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
