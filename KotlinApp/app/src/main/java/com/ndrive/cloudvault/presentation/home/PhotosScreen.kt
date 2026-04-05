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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PhotosScreen(navController: NavController) {
    var isGridView by remember { mutableStateOf(true) } // Photos usually default to grid
    var isLoading by remember { mutableStateOf(true) }

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
                            text = "Search in Photos",
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
                    .clickable { /* New Action */ }
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
            columns = if (isGridView) GridCells.Fixed(3) else GridCells.Fixed(1), // 3 columns for photos grid
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
                        .padding(horizontal = if(isGridView) 0.dp else 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Photos",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium,
                        color = Color.DarkGray
                    )
                    IconButton(onClick = { isGridView = !isGridView }) {
                        Icon(
                            imageVector = if (isGridView) Icons.AutoMirrored.Filled.ViewList else Icons.Default.GridView,
                            contentDescription = "Toggle View",
                            tint = Color.DarkGray
                        )
                    }
                }
            }

            if (isLoading) {
                items(15) {
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
                val mockPhotos = listOf(
                    Triple("IMG_20231015.jpg", "Yesterday", Color(0xFFDB4437)),
                    Triple("Screenshot_124.png", "Yesterday", Color(0xFFDB4437)),
                    Triple("IMG_20231010.jpg", "Last week", Color(0xFFDB4437)),
                    Triple("Family_Portrait.jpg", "Last week", Color(0xFFDB4437)),
                    Triple("Sunset.jpg", "Last month", Color(0xFFDB4437))
                )

                items(mockPhotos.size) { index ->
                    if (isGridView) {
                        FileCard(name = mockPhotos[index].first, isImage = true) {}
                    } else {
                        FileRow(
                            name = mockPhotos[index].first,
                            subtitle = mockPhotos[index].second,
                            iconTint = mockPhotos[index].third,
                            isLoading = false
                        ) {}
                    }
                }
            }
        }
    }
}
