package com.ndrive.cloudvault.presentation.home

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ndrive.cloudvault.domain.model.DriveFile
import com.ndrive.cloudvault.domain.model.DriveFolder
import com.ndrive.cloudvault.presentation.common.resolveFileIconStyle
import com.ndrive.cloudvault.presentation.home.components.FileCard
import com.ndrive.cloudvault.presentation.home.components.FileRow
import com.ndrive.cloudvault.presentation.home.components.FolderCard
import com.ndrive.cloudvault.presentation.home.components.FolderGridCard
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav
import com.ndrive.cloudvault.presentation.home.components.GridListToggle
import com.ndrive.cloudvault.presentation.home.components.CreateNewBottomSheet
import com.ndrive.cloudvault.presentation.home.components.AppDrawer
import com.ndrive.cloudvault.presentation.home.components.TopSearchBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilesScreen(
    navController: NavController,
    viewModel: FilesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var isGridView by rememberSaveable { mutableStateOf(false) }
    var selectedTabIndex by rememberSaveable { mutableIntStateOf(0) }
    var showCreateSheet by remember { mutableStateOf(false) }
    var showAppDrawer by remember { mutableStateOf(false) }

    val tabs = remember { listOf("All", "Recent", "Starred") }

    val foldersByName = remember(uiState.folders) {
        uiState.folders.sortedWith(FOLDER_NAME_COMPARATOR)
    }
    val filesByName = remember(uiState.files) {
        uiState.files.sortedWith(FILE_NAME_COMPARATOR)
    }
    val recentFiles = remember(uiState.files) {
        uiState.files.sortedWith(FILE_RECENT_COMPARATOR)
    }
    val starredFolders = remember(foldersByName) {
        foldersByName.filter { it.isStarred }
    }
    val starredFiles = remember(filesByName) {
        filesByName.filter { it.isStarred }
    }

    val visibleFolders = remember(selectedTabIndex, foldersByName, starredFolders) {
        when (selectedTabIndex) {
            1 -> emptyList() // Recent tab only shows files
            2 -> starredFolders
            else -> foldersByName
        }
    }

    val visibleFiles = remember(selectedTabIndex, filesByName, recentFiles, starredFiles) {
        when (selectedTabIndex) {
            1 -> recentFiles
            2 -> starredFiles
            else -> filesByName
        }
    }

    val navigateToPreview: (String) -> Unit = { fileId ->
        navController.navigate("preview/${Uri.encode(fileId)}")
    }

    val sheetState = rememberModalBottomSheetState()

    val backgroundColor = MaterialTheme.colorScheme.background
    val primaryColor = MaterialTheme.colorScheme.primary

    Scaffold(
        containerColor = backgroundColor,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(backgroundColor)
                    .statusBarsPadding()
            ) {
                Spacer(modifier = Modifier.height(8.dp))
                TopSearchBar(
                    onMenuClick = { showAppDrawer = true },
                    onProfileClick = { navController.navigate("profile_route") },
                    onSearchClick = { navController.navigate("search") }
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ScrollableTabRow(
                        selectedTabIndex = selectedTabIndex,
                        containerColor = backgroundColor,
                        contentColor = primaryColor,
                        edgePadding = 0.dp,
                        divider = {},
                        indicator = { tabPositions ->
                            if (selectedTabIndex < tabPositions.size) {
                                Box(
                                    modifier = Modifier
                                        .tabIndicatorOffset(tabPositions[selectedTabIndex])
                                        .height(3.dp)
                                        .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                        .background(primaryColor)
                                )
                            }
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        tabs.forEachIndexed { index, title ->
                            Tab(
                                selected = selectedTabIndex == index,
                                onClick = { selectedTabIndex = index },
                                text = {
                                    Text(
                                        text = title,
                                        fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Medium,
                                        color = if (selectedTabIndex == index) primaryColor else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                },
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    GridListToggle(
                        isGridView = isGridView,
                        onToggle = { isGridView = !isGridView }
                    )
                }
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateSheet = true },
                containerColor = primaryColor,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .padding(bottom = 16.dp)
                    .shadow(8.dp, RoundedCornerShape(16.dp))
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add New")
            }
        },
        bottomBar = {
            NDriveBottomNav(navController = navController)
        }
    ) { paddingValues ->
        AppDrawer(
            isOpen = showAppDrawer,
            onClose = { showAppDrawer = false },
            onMenuItemClick = { itemLabel ->
                if (itemLabel == "Uploads") {
                    navController.navigate("uploads")
                }
            },
        )

        val pullRefreshState = rememberPullToRefreshState()
        PullToRefreshBox(
            isRefreshing = uiState.isLoading,
            onRefresh = { viewModel.refresh() },
            state = pullRefreshState,
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(if (isGridView) 2 else 1),
                contentPadding = PaddingValues(top = 8.dp, bottom = 88.dp),
                horizontalArrangement = Arrangement.spacedBy(0.dp),
                verticalArrangement = Arrangement.spacedBy(if (isGridView) 16.dp else 0.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                uiState.errorMessage?.let { errorMessage ->
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                            ),
                        ) {
                            Text(
                                text = errorMessage,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }

                if (uiState.isLoading) {
                    items(
                        count = 8,
                        key = { index -> "loading-$index" },
                        contentType = { "loading" },
                    ) { index ->
                        if (isGridView) {
                            Box(
                                modifier = Modifier.padding(
                                    start = if (index % 2 == 0) 16.dp else 8.dp,
                                    end = if (index % 2 == 0) 8.dp else 16.dp
                                )
                            ) {
                                FileCard(name = "", isLoading = true) {}
                            }
                        } else {
                            if (index < 3) {
                                FolderCard(
                                    name = "",
                                    subtitle = "",
                                    isLoading = true,
                                ) { }
                            } else {
                                FileRow(
                                    name = "",
                                    subtitle = "",
                                    isLoading = true,
                                ) { }
                            }
                        }
                    }
                } else {
                    items(
                        count = visibleFolders.size,
                        key = { index -> visibleFolders[index].id },
                        contentType = { "folder" },
                    ) { index ->
                        val folder = visibleFolders[index]
                        if (isGridView) {
                            Box(
                                modifier = Modifier.padding(
                                    start = if (index % 2 == 0) 16.dp else 8.dp,
                                    end = if (index % 2 == 0) 8.dp else 16.dp
                                )
                            ) {
                                FolderGridCard(name = folder.name) {
                                    navController.navigate("folder/${Uri.encode(folder.id)}")
                                }
                            }
                        } else {
                            FolderCard(
                                name = folder.name,
                                subtitle = formatUpdatedAt(folder.updatedAt),
                                iconTint = Color(0xFF4285F4),
                            ) {
                                navController.navigate("folder/${Uri.encode(folder.id)}")
                            }
                        }
                    }

                    items(
                        count = visibleFiles.size,
                        key = { index -> visibleFiles[index].id },
                        contentType = { "file" },
                    ) { index ->
                        val file = visibleFiles[index]
                        val fileIconStyle = resolveFileIconStyle(file.name, file.mimeType)
                        if (isGridView) {
                            val globalIndex = visibleFolders.size + index
                            Box(
                                modifier = Modifier.padding(
                                    start = if (globalIndex % 2 == 0) 16.dp else 8.dp,
                                    end = if (globalIndex % 2 == 0) 8.dp else 16.dp,
                                )
                            ) {
                                FileCard(
                                    name = file.name,
                                    thumbnailUrl = file.thumbnailUrl,
                                    isImage = fileIconStyle.prefersMediaPreview,
                                    fileTypeIcon = fileIconStyle.icon,
                                    fileTypeTint = fileIconStyle.tint,
                                ) {
                                    navigateToPreview(file.id)
                                }
                            }
                        } else {
                            FileRow(
                                name = file.name,
                                subtitle = formatUpdatedAt(file.updatedAt),
                                iconTint = fileIconStyle.tint,
                                iconVector = fileIconStyle.icon,
                                isLoading = false,
                            ) {
                                navigateToPreview(file.id)
                            }
                        }
                    }

                    if (visibleFolders.isEmpty() && visibleFiles.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 48.dp, start = 16.dp, end = 16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(
                                    text = when (selectedTabIndex) {
                                        1 -> "No recent files"
                                        2 -> "No starred items"
                                        else -> "No files or folders yet"
                                    },
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = when (selectedTabIndex) {
                                        1 -> "Upload or edit files to see them in Recent."
                                        2 -> "Star files or folders to quickly access them here."
                                        else -> "Create folders or upload files to get started."
                                    },
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateSheet) {
        CreateNewBottomSheet(
            sheetState = sheetState,
            onDismissRequest = { showCreateSheet = false }
        )
    }
}

private val FOLDER_NAME_COMPARATOR =
    compareBy<DriveFolder, String>(String.CASE_INSENSITIVE_ORDER) { it.name }

private val FILE_NAME_COMPARATOR =
    compareBy<DriveFile, String>(String.CASE_INSENSITIVE_ORDER) { it.name }

private val FILE_RECENT_COMPARATOR =
    compareByDescending<DriveFile> { it.updatedAt.orEmpty() }
        .then(FILE_NAME_COMPARATOR)

private fun formatUpdatedAt(updatedAt: String?): String {
    if (updatedAt.isNullOrBlank()) return "Modified recently"
    val date = updatedAt.substringBefore('T').takeIf { it.length == 10 } ?: updatedAt.take(10)
    return "Modified $date"
}







