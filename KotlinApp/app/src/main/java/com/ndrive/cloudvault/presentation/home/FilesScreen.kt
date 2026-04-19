package com.ndrive.cloudvault.presentation.home

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Slideshow
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ndrive.cloudvault.presentation.home.components.FileCard
import com.ndrive.cloudvault.presentation.home.components.FileRow
import com.ndrive.cloudvault.presentation.home.components.FolderCard
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav       
import kotlinx.coroutines.delay

import com.ndrive.cloudvault.presentation.home.components.GridListToggle        
import com.ndrive.cloudvault.presentation.home.components.CreateNewBottomSheet  
import com.ndrive.cloudvault.presentation.home.components.AppDrawer
import com.ndrive.cloudvault.presentation.home.components.TopSearchBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilesScreen(navController: androidx.navigation.NavController, viewModel: FilesViewModel = androidx.hilt.navigation.compose.hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    var isGridView by remember { mutableStateOf(false) }

    val navigateToPreview: (String) -> Unit = { fileId ->
        navController.navigate("preview/${Uri.encode(fileId)}")
    }

    var selectedTabIndex by remember { mutableStateOf(0) }

    var showCreateSheet by remember { mutableStateOf(false) }
    var showAppDrawer by remember { mutableStateOf(false) }
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

                // Tabs and Grid/List toggle row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val tabs = listOf("All", "Recent", "Starred")
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
        // Folders and Files content
        LazyVerticalGrid(
            columns = GridCells.Fixed(if (isGridView) 2 else 1),
            contentPadding = PaddingValues(
                start = if (isGridView) 16.dp else 0.dp,
                end = if (isGridView) 16.dp else 0.dp,
                top = 8.dp,
                bottom = 88.dp
            ),
            horizontalArrangement = Arrangement.spacedBy(if (isGridView) 16.dp else 0.dp),
            verticalArrangement = Arrangement.spacedBy(if (isGridView) 16.dp else 0.dp),
            modifier = Modifier.fillMaxSize()
        ) {
                if (uiState.isLoading) {
                    items(8) {
                        if (isGridView) FileCard(name = "", isLoading = true) {}
                        else {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(72.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                            )
                        }
                    }
                } else {
                    items(uiState.folders.size) { index ->
                        val folder = uiState.folders[index]
                        if (isGridView) {
                            com.ndrive.cloudvault.presentation.home.components.FolderGridCard(name = folder.name) {
                                navController.navigate("folder/${Uri.encode(folder.id)}")
                            }
                        } else {
                            FolderCard(
                                name = folder.name,
                                subtitle = folder.updatedAt ?: "Unknown",
                                iconTint = Color(0xFF4285F4)
                            ) {
                                navController.navigate("folder/${Uri.encode(folder.id)}")
                            }
                        }
                    }

                    items(uiState.files.size) { index -> 
                        val file = uiState.files[index]
                        if(isGridView) {
                           FileCard(name=file.name, thumbnailUrl=file.thumbnailUrl, isImage=file.mimeType.startsWith("image/") || file.mimeType.startsWith("video/")) {
                               navigateToPreview(file.id)
                           }
                        } else {
                           FileRow(
                               name=file.name, 
                               subtitle=file.updatedAt?:"Unknown", 
                               iconTint = Color(0xFFEA4335),
                               isLoading=false
                           ) {
                               navigateToPreview(file.id)
                           }
                        } 
                    }
                }
            }
        } // end PullToRefreshBox
    }

    if (showCreateSheet) {
        CreateNewBottomSheet(
            sheetState = sheetState,
            onDismissRequest = { showCreateSheet = false }
        )
    }
}

class FileMock(val name: String, val subtitle: String, val tint: Color, val icon: androidx.compose.ui.graphics.vector.ImageVector)







