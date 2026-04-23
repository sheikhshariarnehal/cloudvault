package com.ndrive.cloudvault.presentation.home.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.material.icons.filled.Description
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.ndrive.cloudvault.presentation.common.shimmerEffect

@Composable
fun FileCard(
    name: String,
    thumbnailUrl: String? = null,
    isImage: Boolean = false,
    fileTypeIcon: ImageVector = Icons.Default.Description,
    fileTypeTint: Color = Color(0xFF5F6368),
    isLoading: Boolean = false,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.85f)
            .clickable(enabled = !isLoading) { onClick() }
    ) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize().shimmerEffect())
            return@Card
        }

        Column(modifier = Modifier.fillMaxSize()) {
            // Preview Area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(if (isImage) Color.Black else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                if (thumbnailUrl != null) {
                    val finalUrl = if (thumbnailUrl.startsWith("http") || thumbnailUrl.startsWith("data:")) {
                        thumbnailUrl
                    } else {
                        "https://pub-99b846451dcc4c879db177b7e8b60c2f.r2.dev/$thumbnailUrl"
                    }
                    val context = LocalContext.current
                    AsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(finalUrl)
                            .crossfade(300)
                            .memoryCachePolicy(CachePolicy.ENABLED)
                            .diskCachePolicy(CachePolicy.ENABLED)
                            .build(),
                        contentDescription = name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        imageVector = if (isImage) Icons.Default.Image else fileTypeIcon,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = if (isImage) {
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                        } else {
                            fileTypeTint.copy(alpha = 0.45f)
                        }
                    )
                }
            }

            HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)

            // Footer Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (isImage) Icons.Default.Image else fileTypeIcon,
                    contentDescription = null,
                    tint = if (isImage) MaterialTheme.colorScheme.secondary else fileTypeTint,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                IconButton(onClick = { /* Menu */ }, modifier = Modifier.size(24.dp)) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "More",
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

        }
    }
}

