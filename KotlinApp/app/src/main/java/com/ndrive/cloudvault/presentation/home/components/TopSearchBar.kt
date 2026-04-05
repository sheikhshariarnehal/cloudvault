package com.ndrive.cloudvault.presentation.home.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun TopSearchBar(
    onMenuClick: () -> Unit,
    onProfileClick: () -> Unit,
    onSearchClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val searchBarColor = Color(0xFFEDF2FA)
    val avatarColor = Color(0xFF4C6A9B)

    Surface(
        shape = CircleShape,
        color = searchBarColor,
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .padding(horizontal = 16.dp)
            .clickable(onClick = onSearchClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, contentDescription = "Menu", tint = Color.DarkGray)
            }
            Spacer(Modifier.width(8.dp))
            Text(
                text = "Search in Drive",
                fontSize = 16.sp,
                color = Color.DarkGray,
                modifier = Modifier.weight(1f)
            )
            Box {
                Surface(
                    shape = CircleShape,
                    color = avatarColor,
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onProfileClick)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("R", color = Color.White, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}
