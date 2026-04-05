package com.ndrive.cloudvault.presentation.home

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
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndrive.cloudvault.presentation.home.components.FileCard
import com.ndrive.cloudvault.presentation.home.components.FileRow
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav
import kotlinx.coroutines.delay

import com.ndrive.cloudvault.presentation.home.components.GridListToggle
import com.ndrive.cloudvault.presentation.home.components.CreateNewBottomSheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StarredScreen(navController: NavController) {
    var isGridView by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }

    var showCreateSheet by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()
    
    val backgroundColor = Color(0xFFF8F9FA)
    val searchBarColor = Color(0xFFEDF2FA)
    val avatarColor = Color(0xFF4C6A9B)

    LaunchedEffect(Unit) {
        delay(1200)
        isLoading = false
    }

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
                // Beautiful Pill Search Bar
                Surface(
                    shape = CircleShape,
                    color = searchBarColor,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .padding(horizontal = 16.dp)
                        .clickable { /* Handle search */ }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Menu, "Menu", tint = Color.DarkGray)
                        Spacer(Modifier.width(16.dp))
                        Text(
                            text = "Search in Drive",
                            fontSize = 16.sp,
                            color = Color.DarkGray,
                            modifier = Modifier.weight(1f)
                        )
                        Surface(
                            shape = CircleShape,
                            color = avatarColor,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("R", color = Color.White, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))
            }
        },
        floatingActionButton = {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFFE8F0FE),
                shadowElevation = 4.dp,
                modifier = Modifier
                    .padding(end = 8.dp, bottom = 8.dp)
                    .clickable { showCreateSheet = true }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Add, contentDescription = "New", tint = Color(0xFF1F1F1F))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        "New",
                        color = Color(0xFF1F1F1F),
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
                        "Starred files",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium,
                        color = Color.DarkGray
                    )
                    GridListToggle(isGridView = isGridView, onToggle = { isGridView = !isGridView })
                }
            }

            if (isLoading) {
                items(5) {
                    if (isGridView) FileCard(name = "", isLoading = true) {}
                    else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(64.dp)
                                .padding(horizontal = 16.dp, vertical = 8.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.LightGray.copy(alpha=0.3f))
                        )
                    }
                }
            } else {
                val mockFiles = listOf(
                    Triple("Project Harrison Tracker", "You opened \u2022 Oct 31, 2022", Color(0xFF0F9D58)),
                    Triple("Leadership & Organization...", "Mustafa Krishnamurthy replied...", Color(0xFFF4B400)),
                    Triple("Important Passwords", "You edited \u2022 Last week", Color(0xFF4285F4))
                )

                items(mockFiles.size) { index ->
                    if (isGridView) {
                        FileCard(name = mockFiles[index].first, isImage = false) {}
                    } else {
                        FileRow(
                            name = mockFiles[index].first,
                            subtitle = mockFiles[index].second,
                            iconTint = mockFiles[index].third,
                            isLoading = false
                        ) {}
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
