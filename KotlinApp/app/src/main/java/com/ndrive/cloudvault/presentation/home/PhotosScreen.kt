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
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.ndrive.cloudvault.presentation.common.shimmerEffect
import com.ndrive.cloudvault.presentation.home.components.FileRow
import com.ndrive.cloudvault.presentation.home.components.GridListToggle
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav
import com.ndrive.cloudvault.presentation.home.components.CreateNewBottomSheet
import kotlinx.coroutines.delay

@Composable
fun PhotoThumbnail(url: String, isLoading: Boolean = false) {
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFE0E0E0)) // placeholder color like grey
    ) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize().shimmerEffect())
        } else {
            // Simulated photo colors using a background before image loads
            Box(modifier = Modifier.fillMaxSize().background(Color(0xFF81D4FA))) 
            // In a real app you use AsyncImage here
            /*
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            */
        }
    }
}





@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PhotosScreen(navController: NavController) {
    var isGridView by remember { mutableStateOf(true) } // Photos usually default to grid
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
                Spacer(modifier = Modifier.height(16.dp))
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
            columns = if (isGridView) GridCells.Fixed(3) else GridCells.Fixed(1), 
            contentPadding = PaddingValues(
                start = 12.dp, // overall horizontal padding
                end = 12.dp,
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 88.dp
            ),
            horizontalArrangement = Arrangement.spacedBy(4.dp), // Google photos grid usually has ~2-4 dp gap
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "AUGUST", // example Month header
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.DarkGray, letterSpacing = 1.sp
                    )
                    GridListToggle(isGridView = isGridView, onToggle = { isGridView = !isGridView })
                }
            }

            if (isLoading) {
                items(12) {
                    if (isGridView) PhotoThumbnail(url = "", isLoading = true)
                    else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(64.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.LightGray.copy(alpha=0.3f))
                        )
                    }
                }
            } else {
                // Section 1 Mock photos
                val section1Count = 6
                items(section1Count) { index ->
                    if (isGridView) {
                        PhotoThumbnail(url = "mock$index") 
                    } else {
                        FileRow(
                            name = "IMG_000$index.jpg",
                            subtitle = "August 12",
                            iconTint = Color(0xFFDB4437),
                            isLoading = false
                        ) {}
                    }
                }
                
                // Section 2 Header
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Text(
                        "JULY",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.DarkGray,
                        letterSpacing = 1.sp,
                        modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
                    )
                }

                // Section 2 Mock photos
                val section2Count = 9
                items(section2Count) { index ->
                    if (isGridView) {
                        // Some different color backgrounds for mockup visually
                        Box(
                            modifier = Modifier
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if(index % 2 == 0) Color(0xFFA1E7D1) else Color(0xFFE8F5E9))
                        )
                    } else {
                        FileRow(
                            name = "DSC_092$index.jpg",
                            subtitle = "July 1",
                            iconTint = Color(0xFFDB4437),
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
