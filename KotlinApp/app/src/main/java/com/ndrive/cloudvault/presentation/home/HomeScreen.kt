package com.ndrive.cloudvault.presentation.home

import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.filled.Close
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
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
import com.ndrive.cloudvault.presentation.home.components.NDriveBottomNav
import kotlinx.coroutines.delay

import com.ndrive.cloudvault.presentation.home.components.GridListToggle
import com.ndrive.cloudvault.presentation.home.components.CreateNewBottomSheet
import com.ndrive.cloudvault.presentation.home.components.AppDrawer
import com.ndrive.cloudvault.presentation.home.components.TopSearchBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(navController: androidx.navigation.NavController) {
    var isGridView by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedTabIndex by remember { mutableStateOf(0) }
    
    var showCreateSheet by remember { mutableStateOf(false) }
    var showAppDrawer by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    val backgroundColor = Color(0xFFF8F9FA) // Light grey background like Google Drive
    val searchBarColor = Color(0xFFEDF2FA)
    val avatarColor = Color(0xFF4C6A9B)
    val primaryColor = Color(0xFF0B57D0)

    LaunchedEffect(Unit) {
        delay(1200)
        isLoading = false
    }

    val mockFiles = remember {
        listOf(
            Triple("Monthly Notes", "You edited \u2022 10:23 AM", Color(0xFF4285F4)),
            Triple("Leadership & Organization...", "Mustafa Krishnamurthy replied...", Color(0xFFF4B400)),
            Triple("Monthly Forecast", "You edited \u2022 Nov 1, 2022", Color(0xFF0F9D58)),
            Triple("Monthly Revenue", "You edited \u2022 Nov 1, 2022", Color(0xFF0F9D58)),
            Triple("Q4 Proposal", "Rose James commented \u2022 Oct 31...", Color(0xFFDB4437)),
            Triple("Project Harrison Tracker", "You opened \u2022 Oct 31, 2022", Color(0xFF0F9D58)),
            Triple("Acme_ExpenseForm", "You edited \u2022 Oct 31, 2022", Color(0xFF4285F4))
        )
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
                TopSearchBar(
                    onMenuClick = { showAppDrawer = true },
                    onProfileClick = { navController.navigate("profile_route") }
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Custom Tab Row
                TabRow(
                    selectedTabIndex = selectedTabIndex,
                    containerColor = backgroundColor,
                    contentColor = primaryColor,
                    divider = { HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0)) },
                    indicator = { tabPositions ->
                        TabRowDefaults.SecondaryIndicator(
                            Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                            height = 3.dp,
                            color = primaryColor,
                            // Rounded indicator
                            
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
                                color = if (selectedTabIndex == 0) primaryColor else Color.DarkGray
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
                                color = if (selectedTabIndex == 1) primaryColor else Color.DarkGray
                            )
                        }
                    )
                }
            }
        },
        floatingActionButton = {
            // Updated '+ New' FAB matching Google Drive shadow & color
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFFE8F0FE),
                shadowElevation = 4.dp, // Soft shadow
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
                bottom = padding.calculateBottomPadding() + 88.dp // Space for scrolling under FAB
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
                        "Files",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium,
                        color = Color.DarkGray
                    )
                    GridListToggle(isGridView = isGridView, onToggle = { isGridView = !isGridView })
                }
            }

            if (isLoading) {
                items(8) {
                    if (isGridView) FileCard(name = "", isLoading = true) {}
                    else {
                        Box( // Provide shimmer skeleton matching row height
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

    AppDrawer(
        isOpen = showAppDrawer,
        onClose = { showAppDrawer = false }
    )
}
