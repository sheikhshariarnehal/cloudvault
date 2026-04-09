package com.ndrive.cloudvault.presentation.upload

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ndrive.cloudvault.presentation.home.UploadItemStatus
import com.ndrive.cloudvault.presentation.home.UploadItemUiState
import com.ndrive.cloudvault.presentation.home.UploadPanelState

@Composable
fun UploadProgressOverlay(
	panel: UploadPanelState,
	modifier: Modifier = Modifier,
	onToggleExpanded: () -> Unit,
	onDismissAll: () -> Unit,
	onDismissItem: (Long) -> Unit,
) {
	if (!panel.isVisible) return

	val totalCount = panel.items.size
	val doneCount = panel.items.count { it.status == UploadItemStatus.SUCCESS || it.status == UploadItemStatus.ERROR }
	val uploadingCount = panel.items.count { it.status == UploadItemStatus.UPLOADING || it.status == UploadItemStatus.QUEUED }
	val overallProgress = if (totalCount == 0) {
		0f
	} else {
		panel.items.sumOf { it.progressPercent }.toFloat() / (totalCount * 100f)
	}.coerceIn(0f, 1f)

	Card(
		modifier = modifier.animateContentSize(),
		colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
	) {
		Column(
			modifier = Modifier
				.fillMaxWidth()
				.padding(12.dp),
			verticalArrangement = Arrangement.spacedBy(10.dp),
		) {
			Row(
				modifier = Modifier.fillMaxWidth(),
				verticalAlignment = Alignment.CenterVertically,
				horizontalArrangement = Arrangement.SpaceBetween,
			) {
				Column(modifier = Modifier.weight(1f)) {
					Text(
						text = if (panel.isRunning) "Uploading files" else "Uploads",
						style = MaterialTheme.typography.titleSmall,
					)
					Text(
						text = panel.summaryMessage
							?: if (panel.isRunning) "$doneCount of $totalCount completed" else "No active uploads",
						style = MaterialTheme.typography.bodySmall,
						color = MaterialTheme.colorScheme.onSurfaceVariant,
					)
				}
				Row(verticalAlignment = Alignment.CenterVertically) {
					IconButton(onClick = onToggleExpanded, enabled = panel.items.isNotEmpty()) {
						Icon(
							imageVector = if (panel.isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
							contentDescription = if (panel.isExpanded) "Collapse" else "Expand",
						)
					}
					IconButton(onClick = onDismissAll, enabled = !panel.isRunning) {
						Icon(Icons.Default.Close, contentDescription = "Dismiss all")
					}
				}
			}

			if (totalCount > 0) {
				LinearProgressIndicator(
					progress = { overallProgress },
					modifier = Modifier.fillMaxWidth(),
				)
				Text(
					text = when {
						panel.isRunning -> "$uploadingCount uploading"
						panel.failedCount > 0 -> "${panel.successCount} succeeded, ${panel.failedCount} failed"
						else -> "${panel.successCount} uploaded"
					},
					style = MaterialTheme.typography.bodySmall,
					color = MaterialTheme.colorScheme.onSurfaceVariant,
				)
			}

			if (panel.isExpanded && panel.items.isNotEmpty()) {
				HorizontalDivider()
				Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
					panel.items.forEachIndexed { index, item ->
						UploadQueueRow(item = item, onDismissItem = onDismissItem)
						if (index < panel.items.lastIndex) {
							HorizontalDivider()
						}
					}
				}
			}
		}
	}
}


@Composable
private fun UploadQueueRow(
	item: UploadItemUiState,
	onDismissItem: (Long) -> Unit,
) {
	Row(
		modifier = Modifier
			.fillMaxWidth()
			.padding(vertical = 8.dp),
		verticalAlignment = Alignment.CenterVertically,
		horizontalArrangement = Arrangement.spacedBy(12.dp),
	) {
		Box(
			modifier = Modifier.size(30.dp),
			contentAlignment = Alignment.Center,
		) {
			when (item.status) {
				UploadItemStatus.SUCCESS -> Icon(
					imageVector = Icons.Default.CheckCircle,
					contentDescription = "Uploaded",
					tint = MaterialTheme.colorScheme.primary,
				)

				UploadItemStatus.ERROR -> Icon(
					imageVector = Icons.Default.Error,
					contentDescription = "Upload failed",
					tint = MaterialTheme.colorScheme.error,
				)

				UploadItemStatus.UPLOADING,
				UploadItemStatus.QUEUED,
				-> CircularProgressIndicator(
					progress = {
						(item.progressPercent.coerceIn(0, 100) / 100f).let { progress ->
							if (item.status == UploadItemStatus.QUEUED) 0f else progress
						}
					},
					modifier = Modifier.size(24.dp),
					strokeWidth = 2.5.dp,
				)
			}
		}

		Column(modifier = Modifier.weight(1f)) {
			Text(
				text = item.fileName,
				style = MaterialTheme.typography.bodyMedium,
			)

			val subtitle = when (item.status) {
				UploadItemStatus.QUEUED -> "Waiting in queue"
				UploadItemStatus.UPLOADING -> "${item.progressPercent}% - ${item.message ?: "Uploading"}"
				UploadItemStatus.SUCCESS -> "Uploaded"
				UploadItemStatus.ERROR -> item.message ?: "Upload failed"
			}

			Text(
				text = subtitle,
				style = MaterialTheme.typography.bodySmall,
				color = MaterialTheme.colorScheme.onSurfaceVariant,
			)

			if (item.status == UploadItemStatus.ERROR && item.retryAfterSeconds != null) {
				Text(
					text = "Retry after ${item.retryAfterSeconds}s",
					style = MaterialTheme.typography.bodySmall,
					color = MaterialTheme.colorScheme.onSurfaceVariant,
				)
			}
		}

		val isDismissable = item.status == UploadItemStatus.SUCCESS || item.status == UploadItemStatus.ERROR
		if (isDismissable) {
			IconButton(onClick = { onDismissItem(item.id) }) {
				Icon(Icons.Default.Close, contentDescription = "Dismiss")
			}
		}
	}
}
