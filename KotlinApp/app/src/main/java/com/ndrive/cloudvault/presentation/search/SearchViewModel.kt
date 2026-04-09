package com.ndrive.cloudvault.presentation.search

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

data class SearchUiState(
    val query: String = "",
    val isLoading: Boolean = false,
    val allFiles: List<DriveFile> = emptyList(),
    val allFolders: List<DriveFolder> = emptyList(),
    val recentSearches: List<String> = emptyList(),
    val isGridView: Boolean = true,
    val errorMessage: String? = null
) {
    /** Whether the user has typed anything */
    val hasQuery: Boolean get() = query.isNotBlank()

    val filteredFiles: List<DriveFile>
        get() {
            val q = query.trim().lowercase()
            return if (q.isBlank()) emptyList()
            else allFiles.filter { it.name.lowercase().contains(q) }
        }

    val filteredFolders: List<DriveFolder>
        get() {
            val q = query.trim().lowercase()
            return if (q.isBlank()) emptyList()
            else allFolders.filter { it.name.lowercase().contains(q) }
        }
}

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val fileRepository: FileRepository,
    private val folderRepository: FolderRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val filesDeferred   = async { fileRepository.getRecentFiles(limit = 100) }
            val foldersDeferred = async { folderRepository.getRootFolders(limit = 50) }

            val files   = filesDeferred.await().getOrElse { emptyList() }
            val folders = foldersDeferred.await().getOrElse { emptyList() }

            _uiState.update {
                it.copy(isLoading = false, allFiles = files, allFolders = folders)
            }
        }
    }

    fun updateQuery(query: String) {
        _uiState.update { it.copy(query = query) }
    }

    /** Call when user submits the search (keyboard action / taps a recent item). */
    fun submitSearch(query: String) {
        if (query.isBlank()) return
        _uiState.update { state ->
            val updated = (listOf(query) + state.recentSearches.filter { it != query }).take(10)
            state.copy(query = query, recentSearches = updated)
        }
    }

    fun clearQuery() {
        _uiState.update { it.copy(query = "") }
    }

    fun removeRecentSearch(item: String) {
        _uiState.update { it.copy(recentSearches = it.recentSearches.filter { r -> r != item }) }
    }

    fun toggleGridView() {
        _uiState.update { it.copy(isGridView = !it.isGridView) }
    }
}
