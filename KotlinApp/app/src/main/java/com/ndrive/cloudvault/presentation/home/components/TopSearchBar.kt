package com.ndrive.cloudvault.presentation.home.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Static Google-Drive-style search pill shown on the Home screen.
 * Tapping anywhere calls [onSearchClick] which navigates to the dedicated SearchScreen.
 */
@Composable
fun TopSearchBar(
    onMenuClick: () -> Unit,
    onProfileClick: () -> Unit,
    onSearchClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val searchBarColor = MaterialTheme.colorScheme.surfaceVariant
    val avatarColor    = MaterialTheme.colorScheme.primary

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
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(
                    imageVector = Icons.Default.Menu,
                    contentDescription = "Menu",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.width(4.dp))
            Text(
                text = "Search in Drive",
                fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                        Text(
                            text = "R",
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}
