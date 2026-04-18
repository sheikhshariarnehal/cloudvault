package com.ndrive.cloudvault.presentation.home.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
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
    isTelegramConnected: Boolean = false,
    onSearchClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val searchBarColor = MaterialTheme.colorScheme.surfaceVariant
    val avatarColor    = MaterialTheme.colorScheme.primary
    val connectedBorderBlue = Color(0xFF2F80FF)

    val borderAnimation = rememberInfiniteTransition(label = "profileBorder")
    val borderAlpha = if (isTelegramConnected) {
        borderAnimation.animateFloat(
            initialValue = 0.25f,
            targetValue = 0.45f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 1400),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "profileBorderAlpha",
        ).value
    } else {
        0f
    }
    val ringRotation = if (isTelegramConnected) {
        borderAnimation.animateFloat(
            initialValue = 0f,
            targetValue = 360f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 2200, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
            label = "profileBorderRotation",
        ).value
    } else {
        0f
    }

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
            Box(
                modifier = Modifier
                    .size(40.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (isTelegramConnected) {
                    Canvas(modifier = Modifier.size(36.dp)) {
                        val strokePx = 2.dp.toPx()
                        drawCircle(
                            color = connectedBorderBlue.copy(alpha = borderAlpha),
                            style = Stroke(width = strokePx),
                        )
                        rotate(degrees = ringRotation) {
                            drawArc(
                                color = connectedBorderBlue.copy(alpha = 0.95f),
                                startAngle = -90f,
                                sweepAngle = 120f,
                                useCenter = false,
                                style = Stroke(width = strokePx, cap = StrokeCap.Round),
                            )
                        }
                    }
                }
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
