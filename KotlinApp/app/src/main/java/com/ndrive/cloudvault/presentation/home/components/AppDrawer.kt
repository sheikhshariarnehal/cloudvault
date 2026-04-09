package com.ndrive.cloudvault.presentation.home.components

import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class DrawerItem(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val text: String
)

@Composable
fun AppDrawer(
    isOpen: Boolean,
    onClose: () -> Unit
) {
    val drawerItems = remember {
        listOf(
            DrawerItem(Icons.Outlined.Schedule, "Recent"),
            DrawerItem(Icons.Outlined.FileUpload, "Uploads"),
            DrawerItem(Icons.Outlined.CheckCircle, "Offline"),
            DrawerItem(Icons.Outlined.DeleteOutline, "Trash"),
            DrawerItem(Icons.Outlined.ErrorOutline, "Spam"),
            DrawerItem(Icons.Outlined.Settings, "Settings"),
            DrawerItem(Icons.AutoMirrored.Outlined.HelpOutline, "Help & feedback"),
            DrawerItem(Icons.Outlined.Cloud, "Storage")
        )
    }

    AnimatedVisibility(
        visible = isOpen,
        enter = fadeIn(animationSpec = tween(durationMillis = 300)),
        exit = fadeOut(animationSpec = tween(durationMillis = 300))
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.5f))
                .clickable(
                    indication = null,
                    interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                ) { onClose() }
        ) {
            AnimatedVisibility(
                visible = isOpen,
                enter = slideInHorizontally(
                    initialOffsetX = { fullWidth -> -fullWidth },
                    animationSpec = tween(durationMillis = 300)
                ),
                exit = slideOutHorizontally(
                    targetOffsetX = { fullWidth -> -fullWidth },
                    animationSpec = tween(durationMillis = 300)
                ),
                modifier = Modifier.align(Alignment.CenterStart)
            ) {
                Surface(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(0.85f)
                        .clickable(
                            indication = null,
                            interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                        ) {
                            // Consume clicks so they don't close the overlay
                        },
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(topEnd = 24.dp, bottomEnd = 24.dp),
                shadowElevation = 8.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                ) {
                    // Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp, vertical = 20.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Google Drive",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    HorizontalDivider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f))

                    // Menu Items
                    LazyColumn(
                        modifier = Modifier.weight(1f).padding(horizontal = 8.dp, vertical = 8.dp)
                    ) {
                        items(drawerItems, key = { it.text }) { item ->
                            DrawerMenuItem(
                                icon = item.icon,
                                text = item.text,
                                onClick = onClose
                            )
                        }
                    }

                    // Footer / Storage
                    Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp).navigationBarsPadding()) {
                        LinearProgressIndicator(
                            progress = { 0.56f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp)),
                            color = Color(0xFF8AB4F8),
                            trackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "2.80 GB of 5 TB used",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedButton(
                            onClick = onClose,
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF8AB4F8))
                        ) {
                            Text("Get more storage", fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
    }
}
}

@Composable
private fun DrawerMenuItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    onClick: () -> Unit
) {
    val contentColor = MaterialTheme.colorScheme.onSurface
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(32.dp)) // Round pill shape like Google Drive menu elements
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = text, tint = contentColor.copy(alpha = 0.8f), modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Text(text, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = contentColor)
    }
}
