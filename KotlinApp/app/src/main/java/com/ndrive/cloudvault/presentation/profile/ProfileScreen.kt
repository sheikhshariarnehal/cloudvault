package com.ndrive.cloudvault.presentation.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.compose.runtime.Composable

data class ProfileOption(
    val title: String,
    val icon: ImageVector,
    val isDestructive: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(navController: NavController) {
    val backgroundColor = MaterialTheme.colorScheme.background
    val onBackgroundColor = MaterialTheme.colorScheme.onBackground
    val surfaceColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)

    val settingsOptions = remember {
        listOf(
            ProfileOption("Account details", Icons.Outlined.ManageAccounts),
            ProfileOption("Security & Privacy", Icons.Outlined.Security),
            ProfileOption("Notifications", Icons.Outlined.Notifications),
            ProfileOption("Language", Icons.Outlined.Language)
        )
    }

    val supportOptions = remember {
        listOf(
            ProfileOption("Help & Feedback", Icons.AutoMirrored.Outlined.HelpOutline),
            ProfileOption("About", Icons.Outlined.Info)
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile", fontWeight = FontWeight.Medium) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = backgroundColor,
                    titleContentColor = onBackgroundColor,
                    navigationIconContentColor = onBackgroundColor
                )
            )
        },
        containerColor = backgroundColor
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // Profile Header
            item(key = "Profile_Header") {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color(0xFF4C6A9B),
                        modifier = Modifier.size(96.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                "R",
                                color = Color.White,
                                fontSize = 40.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Rifat Hossain",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = onBackgroundColor
                    )
                    Text(
                        text = "rifat@example.com",
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    FilledTonalButton(
                        onClick = { /* TODO: Edit Profile */ },
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Text("Edit Profile", fontWeight = FontWeight.Medium)
                    }
                    Spacer(modifier = Modifier.height(32.dp))
                }
            }

            // Storage Section
            item(key = "Storage_Section") {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(surfaceColor)
                        .padding(20.dp)
                    
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Cloud, contentDescription = null, tint = Color(0xFF0B57D0))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Storage", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                        }
                        Text("56%", fontWeight = FontWeight.Medium, color = Color(0xFF0B57D0))
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    LinearProgressIndicator(
                        progress = { 0.56f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = Color(0xFF0B57D0),
                        trackColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "2.80 GB of 5 TB used",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.height(32.dp))
            }

            // Settings Header
            item(key = "Settings_Header") {
                Text(
                    text = "Settings",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
                )
            }
            
            // Settings Items
            items(settingsOptions, key = { it.title }) { option ->
                ProfileOptionRow(icon = option.icon, title = option.title)
            }

            // Support Header
            item(key = "Support_Header") {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Support",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
                )
            }

            // Support Items
            items(supportOptions, key = { it.title }) { option ->
                ProfileOptionRow(icon = option.icon, title = option.title)
            }

            // Sign out
            item(key = "SignOut_Btn") {
                Spacer(modifier = Modifier.height(32.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { /* TODO: Sign out */ }
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.width(16.dp))
                    Text("Sign out", fontSize = 16.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.error)
                }
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

@Composable
fun ProfileOptionRow(icon: ImageVector, title: String, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = title,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.weight(1f)
        )
        Icon(
            imageVector = Icons.Outlined.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
        )
    }
}
