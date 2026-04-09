package com.ndrive.cloudvault.presentation.home.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ndrive.cloudvault.presentation.common.shimmerEffect

@Composable
fun FolderCard(
    name: String,
    subtitle: String = "",
    isLoading: Boolean = false,
    iconTint: Color = Color(0xFFF4B400), // Default yellow/orange folder tint
    iconVector: androidx.compose.ui.graphics.vector.ImageVector = Icons.Default.Folder,
    onClick: () -> Unit
) {
    if (isLoading) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .shimmerEffect()
        )
        return
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !isLoading) { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = iconVector,
            contentDescription = "Folder",
            tint = iconTint,
            modifier = Modifier.size(32.dp)
        )
        
        Spacer(modifier = Modifier.width(16.dp))
        
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = name,
                style = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.sp),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (subtitle.isNotEmpty()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        IconButton(onClick = { /* Menu */ }, modifier = Modifier.size(24.dp)) {
            Icon(
                imageVector = Icons.Default.MoreVert,
                contentDescription = "More",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
