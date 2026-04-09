package com.ndrive.cloudvault.presentation.search

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ndrive.cloudvault.presentation.home.components.FileCard
import com.ndrive.cloudvault.presentation.home.components.FileRow
import com.ndrive.cloudvault.presentation.home.components.FolderCard

@Composable
fun SearchScreen(
    navController: NavController,
    viewModel: SearchViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    val backgroundColor = MaterialTheme.colorScheme.background

    Scaffold(
        containerColor = backgroundColor,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(backgroundColor)
                    .statusBarsPadding()
            ) {
                // ── Search text field row ────────────────────────────────────
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    TextField(
                        value = uiState.query,
                        onValueChange = { viewModel.updateQuery(it) },
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(focusRequester),
                        placeholder = {
                            Text(
                                "Search in Drive",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(
                            onSearch = {
                                viewModel.submitSearch(uiState.query)
                                keyboardController?.hide()
                            }
                        ),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor   = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            focusedIndicatorColor   = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                            cursorColor             = MaterialTheme.colorScheme.primary
                        ),
                        textStyle = MaterialTheme.typography.bodyLarge.copy(
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    )

                    // Clear button — only visible when there's text
                    AnimatedVisibility(
                        visible = uiState.query.isNotEmpty(),
                        enter = fadeIn(tween(150)),
                        exit  = fadeOut(tween(150))
                    ) {
                        IconButton(onClick = { viewModel.clearQuery() }) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Clear",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // ── Filter chips ─────────────────────────────────────────────
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    item {
                        SearchFilterChip(label = "Type")
                    }
                    item {
                        SearchFilterChip(label = "People")
                    }
                    item {
                        SearchFilterChip(label = "Modified")
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (!uiState.hasQuery) {
                // ── Empty / Recent searches state ────────────────────────────
                RecentSearchesContent(
                    recentSearches = uiState.recentSearches,
                    onSearchItemClick = { item ->
                        viewModel.submitSearch(item)
                        keyboardController?.hide()
                    },
                    onRemoveItem = { viewModel.removeRecentSearch(it) }
                )
            } else {
                // ── Results state ────────────────────────────────────────────
                SearchResultsContent(
                    uiState = uiState,
                    onToggleGridView = { viewModel.toggleGridView() }
                )
            }
        }
    }
}

// ── Filter chip ───────────────────────────────────────────────────────────────

@Composable
private fun SearchFilterChip(label: String) {
    FilterChip(
        selected = false,
        onClick = { /* TODO: filter dialog */ },
        label = { Text(label, fontSize = 13.sp) },
        trailingIcon = {
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
        },
        shape = RoundedCornerShape(50),
        colors = FilterChipDefaults.filterChipColors(
            containerColor         = Color.Transparent,
            labelColor             = MaterialTheme.colorScheme.onSurface,
            iconColor              = MaterialTheme.colorScheme.onSurface,
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        border = FilterChipDefaults.filterChipBorder(
            enabled        = true,
            selected       = false,
            borderColor    = MaterialTheme.colorScheme.outline,
            borderWidth    = 1.dp
        )
    )
}

// ── Recent searches panel ─────────────────────────────────────────────────────

@Composable
private fun RecentSearchesContent(
    recentSearches: List<String>,
    onSearchItemClick: (String) -> Unit,
    onRemoveItem: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        if (recentSearches.isNotEmpty()) {
            item {
                Text(
                    text = "Recent searches",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                )
            }

            items(recentSearches) { term ->
                RecentSearchRow(
                    term = term,
                    onClick = { onSearchItemClick(term) },
                    onFillClick = { onSearchItemClick(term) }
                )
            }
        }
    }
}

@Composable
private fun RecentSearchRow(
    term: String,
    onClick: () -> Unit,
    onFillClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.History,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp)
        )
        Spacer(Modifier.width(16.dp))
        Text(
            text = term,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        // Arrow-up-left: fill the search field with this term
        IconButton(onClick = onFillClick, modifier = Modifier.size(32.dp)) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = "Use this search",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

// ── Results panel ─────────────────────────────────────────────────────────────

@Composable
private fun SearchResultsContent(
    uiState: SearchUiState,
    onToggleGridView: () -> Unit
) {
    val allItems = uiState.filteredFolders + uiState.filteredFiles // folders first
    val hasResults = allItems.isNotEmpty()

    LazyVerticalGrid(
        columns = if (uiState.isGridView) GridCells.Fixed(2) else GridCells.Fixed(1),
        contentPadding = PaddingValues(
            start  = if (uiState.isGridView) 12.dp else 0.dp,
            end    = if (uiState.isGridView) 12.dp else 0.dp,
            top    = 0.dp,
            bottom = 24.dp
        ),
        horizontalArrangement = Arrangement.spacedBy(if (uiState.isGridView) 10.dp else 0.dp),
        verticalArrangement   = Arrangement.spacedBy(if (uiState.isGridView) 10.dp else 0.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        // ── Sort + view-toggle header ────────────────────────────────────
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment   = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // "Most relevant ▼"
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { /* TODO: sort menu */ }
                ) {
                    Text(
                        text  = "Most relevant",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(Modifier.width(4.dp))
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .background(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.KeyboardArrowDown,
                            contentDescription = "Sort",
                            tint   = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                // List / Grid toggle
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(
                        onClick = { if (uiState.isGridView) onToggleGridView() },
                        colors  = IconButtonDefaults.iconButtonColors(
                            containerColor = if (!uiState.isGridView)
                                MaterialTheme.colorScheme.surfaceVariant
                            else Color.Transparent
                        ),
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ViewList,
                            contentDescription = "List view",
                            tint = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    IconButton(
                        onClick = { if (!uiState.isGridView) onToggleGridView() },
                        colors  = IconButtonDefaults.iconButtonColors(
                            containerColor = if (uiState.isGridView)
                                MaterialTheme.colorScheme.surfaceVariant
                            else Color.Transparent
                        ),
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.GridView,
                            contentDescription = "Grid view",
                            tint = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        if (!hasResults) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 64.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text  = "No results found",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text  = "Try a different search query.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            // Folders
            if (uiState.filteredFolders.isNotEmpty()) {
                items(uiState.filteredFolders.size) { index ->
                    val folder = uiState.filteredFolders[index]
                    if (uiState.isGridView) {
                        FileCard(name = folder.name, isImage = false) {}
                    } else {
                        FolderCard(name = folder.name) {}
                    }
                }
            }

            // Files
            if (uiState.filteredFiles.isNotEmpty()) {
                items(uiState.filteredFiles.size) { index ->
                    val file = uiState.filteredFiles[index]
                    if (uiState.isGridView) {
                        FileCard(
                            name         = file.name,
                            thumbnailUrl = file.thumbnailUrl,
                            isImage      = file.mimeType.startsWith("image/")
                        ) {}
                    } else {
                        val subtitle = buildString {
                            append("Updated")
                            file.updatedAt?.take(10)?.let { append(" • $it") }
                            append(" • ${formatBytes(file.sizeBytes)}")
                        }
                        FileRow(name = file.name, subtitle = subtitle) {}
                    }
                }
            }
        }
    }
}

private fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val kb = bytes / 1024.0
    if (kb < 1024) return "%.1f KB".format(kb)
    val mb = kb / 1024.0
    if (mb < 1024) return "%.1f MB".format(mb)
    val gb = mb / 1024.0
    return "%.2f GB".format(gb)
}
