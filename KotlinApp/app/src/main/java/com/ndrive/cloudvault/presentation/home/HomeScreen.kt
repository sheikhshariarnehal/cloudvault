package com.ndrive.cloudvault.presentation.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.OndemandVideo
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Slideshow
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ndrive.cloudvault.presentation.home.components.AppDrawer
import com.ndrive.cloudvault.presentation.home.components.CreateNewBottomSheet
import com.ndrive.cloudvault.presentation.home.components.FileCard
import com.ndrive.cloudvault.presentation.home.components.FileRow
import com.ndrive.cloudvault.presentation.home.components.FolderCard
import com.ndrive.cloudvault.presentation.home.components.GridListToggle
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav
import com.ndrive.cloudvault.presentation.home.components.TopSearchBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController,
    viewModel: HomeViewModel = hiltViewModel()
) {
    var isGridView by remember { mutableStateOf(false) }
    var selectedTabIndex by remember { mutableStateOf(0) }
    var showCreateSheet by remember { mutableStateOf(false) }
    var showAppDrawer by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()
    val uiState by viewModel.uiState.collectAsState()

    val visibleFolders = remember(uiState.folders, uiState.query) { viewModel.filteredFolders() }
    val visibleFiles = remember(uiState.files, uiState.query) { viewModel.filteredFiles() }

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

                Spacer(modifier = Modifier.height(16.dp))

                TabRow(
                    selectedTabIndex = selectedTabIndex,
                    containerColor = backgroundColor,
                    contentColor = primaryColor,
                    divider = {
                        HorizontalDivider(
                            thickness = 1.dp,
                            color = MaterialTheme.colorScheme.surfaceVariant
                        )
                    },
                    indicator = { tabPositions ->
                        TabRowDefaults.SecondaryIndicator(
                            Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                            height = 3.dp,
                            color = primaryColor
                        )
                    }
                ) {
                    Tab(
                        selected = selectedTabIndex == 0,
                        onClick = { selectedTabIndex = 0 },
                        text = {
                            Text(
                                "Suggested",
                                fontWeight = if (selectedTabIndex == 0) FontWeight.SemiBold else FontWeight.Normal,
                                color = if (selectedTabIndex == 0) primaryColor else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    )
                    Tab(
                        selected = selectedTabIndex == 1,
                        onClick = { selectedTabIndex = 1 },
                        text = {
                            Text(
                                "Activity",
                                fontWeight = if (selectedTabIndex == 1) FontWeight.SemiBold else FontWeight.Normal,
                                color = if (selectedTabIndex == 1) primaryColor else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    )
                }
            }
        },
        floatingActionButton = {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                shadowElevation = 4.dp,
                modifier = Modifier
                    .padding(end = 8.dp, bottom = 8.dp)
                    .clickable { showCreateSheet = true }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "New",
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        "New",
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        fontWeight = FontWeight.Medium,
                        fontSize = 15.sp
                    )
                }
            }
        },
        bottomBar = { NDriveBottomNav(navController) }
    ) { padding ->
        LazyVerticalGrid(
            columns = if (isGridView) GridCells.Fixed(2) else GridCells.Fixed(1),
            contentPadding = PaddingValues(
                start = if (isGridView) 16.dp else 0.dp,
                end = if (isGridView) 16.dp else 0.dp,
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 88.dp
            ),
            horizontalArrangement = Arrangement.spacedBy(if (isGridView) 12.dp else 0.dp),
            verticalArrangement = Arrangement.spacedBy(if (isGridView) 12.dp else 0.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = if (isGridView) 0.dp else 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Home",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    GridListToggle(isGridView = isGridView, onToggle = { isGridView = !isGridView })
                }
            }

            uiState.errorMessage?.let { errorMessage ->
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = errorMessage,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            FilledTonalButton(onClick = { viewModel.refresh() }) {
                                Text("Retry")
                            }
                        }
                    }
                }
            }

            if (uiState.isLoading) {
                items(10) {
                    if (isGridView) {
                        FileCard(name = "", isLoading = true) {}
                    } else {
                        FileRow(name = "", subtitle = "", isLoading = true) {}
                    }
                }
            } else {
                if (visibleFolders.isNotEmpty()) {
                    if (isGridView) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Text(
                                text = "Folders",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }
                    }

                    items(visibleFolders.size) { index ->
                        val folder = visibleFolders[index]
                        if (isGridView) {
                              com.ndrive.cloudvault.presentation.home.components.FolderGridCard(name = folder.name) {}
                          } else {
                            val subtitle = "Modified " + (folder.updatedAt?.take(10) ?: "Unknown")
                            val folderTint = when (folder.color?.lowercase()) {
                                "red" -> Color(0xFFEA4335)
                                "yellow", "orange" -> Color(0xFFFBBC04)
                                "blue" -> Color(0xFF4285F4)
                                "green" -> Color(0xFF34A853)
                                "dark", "gray", "darkgray" -> Color(0xFF5F6368)
                                else -> if (index % 3 == 0) Color(0xFFFBBC04) else if (index % 3 == 1) Color(0xFFEA4335) else Color(0xFF5F6368) // fallback to rotate colors if no color is specified, mimicking the screenshot loosely, actually let's just make it dark gray default if null
                            }
                            FolderCard(name = folder.name, subtitle = subtitle, iconTint = folder.color?.let { folderTint } ?: Color(0xFF5F6368)) {}
                        }
                    }
                }

                if (visibleFiles.isNotEmpty()) {
                    if (isGridView) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Text(
                                text = "Files",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }
                    }
                }

                items(visibleFiles.size) { index ->
                    val file = visibleFiles[index]
                    if (isGridView) {
                        FileCard(
                            name = file.name,
                            thumbnailUrl = file.thumbnailUrl,
                            isImage = file.mimeType.startsWith("image/") || file.mimeType.startsWith("video/")
                        ) {}
                    } else {
                        val subtitle = buildString {
                            if (file.isStarred) append("? ")
                            append("Modified ")
                            append(file.updatedAt?.take(10) ?: "Unknown")
                        }

                        val mimeParts = file.mimeType.lowercase()
                        val (iconVector, tint) = when {
                            mimeParts.contains("image") -> androidx.compose.material.icons.Icons.Default.Image to Color(0xFFEA4335)
                            mimeParts.contains("video") -> androidx.compose.material.icons.Icons.Default.OndemandVideo to Color(0xFFEA4335)
                            mimeParts.contains("audio") -> androidx.compose.material.icons.Icons.Default.LibraryMusic to Color(0xFFEA4335)
                            mimeParts.contains("pdf") -> androidx.compose.material.icons.Icons.Default.PictureAsPdf to Color(0xFFEA4335) // Red pdf
                            mimeParts.contains("sheet") || mimeParts.contains("excel") || mimeParts.contains("csv") -> androidx.compose.material.icons.Icons.Default.TableChart to Color(0xFF34A853) // Green Sheets
                            mimeParts.contains("android") || mimeParts.contains("apk") -> androidx.compose.material.icons.Icons.Default.Android to Color(0xFF34A853) // Green APK
                            mimeParts.contains("presentation") || mimeParts.contains("powerpoint") -> androidx.compose.material.icons.Icons.Default.Slideshow to Color(0xFFFBBC04) // Yellow slides
                            else -> androidx.compose.material.icons.Icons.Default.Description to Color(0xFF4285F4) // Blue doc
                        }

                        FileRow(
                            name = file.name,
                            subtitle = subtitle,
                            iconTint = tint,
                            iconVector = iconVector
                        ) {}
                    }
                }

                if (visibleFolders.isEmpty() && visibleFiles.isEmpty()) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 24.dp, vertical = 40.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (uiState.query.isBlank()) "No files yet" else "No results found",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = if (uiState.query.isBlank()) {
                                    "Upload files or create folders to see them here."
                                } else {
                                    "Try a different search query."
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            FilledTonalButton(onClick = { viewModel.refresh() }) {
                                Text("Refresh")
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

    AppDrawer(
        isOpen = showAppDrawer,
        onClose = { showAppDrawer = false }
    )
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


