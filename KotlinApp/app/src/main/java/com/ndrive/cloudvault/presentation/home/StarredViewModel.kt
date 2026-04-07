package com.ndrive.cloudvault.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ndrive.cloudvault.domain.model.DriveFile
import com.ndrive.cloudvault.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StarredUiState(
        val isLoading: Boolean = true,
        val files: List<DriveFile> = emptyList(),
        val errorMessage: String? = null
)

@HiltViewModel
class StarredViewModel @Inject constructor(
        private val fileRepository: FileRepository
) : ViewModel() {

        private val _uiState = MutableStateFlow(StarredUiState())
        val uiState: StateFlow<StarredUiState> = _uiState.asStateFlow()

        init {
                refresh()
        }

        fun refresh() {
                viewModelScope.launch {
                        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

                        val fileResult = fileRepository.getStarredFiles(limit = 60)

                        _uiState.update {
                                it.copy(
                                        isLoading = false,
                                        files = fileResult.getOrElse { emptyList() },
                                        errorMessage = fileResult.exceptionOrNull()?.message
                                )
                        }
                }
        }
}
