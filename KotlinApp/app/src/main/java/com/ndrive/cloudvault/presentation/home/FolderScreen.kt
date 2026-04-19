package com.ndrive.cloudvault.presentation.home

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ndrive.cloudvault.presentation.home.components.FileCard
import com.ndrive.cloudvault.presentation.home.components.FileRow
import com.ndrive.cloudvault.presentation.home.components.FolderCard
import com.ndrive.cloudvault.presentation.home.components.FolderGridCard
import com.ndrive.cloudvault.presentation.home.components.GridListToggle
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FolderScreen(
    navController: NavController,
    folderId: String,
    viewModel: FolderViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var isGridView by remember { mutableStateOf(false) }

    LaunchedEffect(folderId) {
        viewModel.loadFolder(folderId)
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = { NDriveBottomNav(navController = navController) },
    ) { paddingValues ->
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
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 88.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .statusBarsPadding(),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            IconButton(onClick = {
                                val popped = navController.popBackStack()
                                if (!popped) {
                                    navController.navigate("files") {
                                        launchSingleTop = true
                                    }
                                }
                            }) {
                                Icon(
                                    imageVector = Icons.Default.ArrowBack,
                                    contentDescription = "Back",
                                )
                            }

                            Text(
                                text = uiState.currentFolder?.name ?: "Folder",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f),
                            )

                            GridListToggle(
                                isGridView = isGridView,
                                onToggle = { isGridView = !isGridView },
                            )
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 12.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            uiState.breadcrumbs.forEachIndexed { index, crumb ->
                                if (index > 0) {
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowRight,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(16.dp),
                                    )
                                }

                                val isLast = index == uiState.breadcrumbs.lastIndex
                                Text(
                                    text = crumb.name,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (isLast) {
                                        MaterialTheme.colorScheme.onSurface
                                    } else {
                                        MaterialTheme.colorScheme.primary
                                    },
                                    fontWeight = if (isLast) FontWeight.SemiBold else FontWeight.Normal,
                                    modifier = Modifier
                                        .clickable(enabled = !isLast) {
                                            if (crumb.id == null) {
                                                navController.navigate("files") {
                                                    launchSingleTop = true
                                                }
                                            } else {
                                                navController.navigate("folder/${Uri.encode(crumb.id)}") {
                                                    launchSingleTop = true
                                                }
                                            }
                                        }
                                        .padding(horizontal = 2.dp),
                                )
                            }
                        }
                    }
                }

                uiState.errorMessage?.let { errorMessage ->
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                            ),
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = errorMessage,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                    style = MaterialTheme.typography.bodyMedium,
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
                    items(8) {
                        if (isGridView) {
                            FileCard(name = "", isLoading = true) { }
                        } else {
                            FileRow(name = "", subtitle = "", isLoading = true) { }
                        }
                    }
                } else {
                    if (uiState.folders.isNotEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Text(
                                text = "Folders",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
                            )
                        }

                        items(uiState.folders.size) { index ->
                            val folder = uiState.folders[index]
                            if (isGridView) {
                                FolderGridCard(name = folder.name) {
                                    navController.navigate("folder/${Uri.encode(folder.id)}")
                                }
                            } else {
                                FolderCard(
                                    name = folder.name,
                                    subtitle = "Modified ${folder.updatedAt?.take(10) ?: "Unknown"}",
                                    iconTint = Color(0xFF5F6368),
                                ) {
                                    navController.navigate("folder/${Uri.encode(folder.id)}")
                                }
                            }
                        }
                    }

                    if (uiState.files.isNotEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Text(
                                text = "Files",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
                            )
                        }

                        items(uiState.files.size) { index ->
                            val file = uiState.files[index]
                            if (isGridView) {
                                FileCard(
                                    name = file.name,
                                    thumbnailUrl = file.thumbnailUrl,
                                    isImage = file.mimeType.startsWith("image/") || file.mimeType.startsWith("video/"),
                                ) {
                                    navController.navigate("preview/${Uri.encode(file.id)}")
                                }
                            } else {
                                FileRow(
                                    name = file.name,
                                    subtitle = "Modified ${file.updatedAt?.take(10) ?: "Unknown"}",
                                ) {
                                    navController.navigate("preview/${Uri.encode(file.id)}")
                                }
                            }
                        }
                    }

                    if (uiState.folders.isEmpty() && uiState.files.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 48.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(
                                    text = "This folder is empty",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Upload files into this folder to see them here.",
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
}
