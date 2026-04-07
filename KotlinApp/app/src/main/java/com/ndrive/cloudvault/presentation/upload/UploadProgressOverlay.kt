package com.ndrive.cloudvault.presentation.upload

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ndrive.cloudvault.domain.model.UploadPhase
import com.ndrive.cloudvault.domain.model.UploadState

@Composable
fun UploadProgressOverlay(
	state: UploadState,
	modifier: Modifier = Modifier,
	onDismiss: () -> Unit,
) {
	if (state is UploadState.Idle) return

	Card(modifier = modifier) {
		when (state) {
			is UploadState.InProgress -> {
				Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
					Text(
						text = phaseLabel(state.phase),
						style = MaterialTheme.typography.titleSmall,
					)
					LinearProgressIndicator(
						progress = { (state.progressPercent / 100f).coerceIn(0f, 1f) },
						modifier = Modifier.fillMaxWidth(),
					)
					Text(
						text = "${state.progressPercent}%",
						style = MaterialTheme.typography.bodySmall,
						color = MaterialTheme.colorScheme.onSurfaceVariant,
					)
				}
			}

			is UploadState.Success -> {
				Row(
					modifier = Modifier
						.fillMaxWidth()
						.padding(12.dp),
					verticalAlignment = Alignment.CenterVertically,
					horizontalArrangement = Arrangement.SpaceBetween,
				) {
					Row(verticalAlignment = Alignment.CenterVertically) {
						Icon(
							imageVector = Icons.Default.CheckCircle,
							contentDescription = "Success",
							tint = MaterialTheme.colorScheme.primary,
						)
						Text(
							text = "Uploaded ${state.fileName}",
							modifier = Modifier.padding(start = 8.dp),
							style = MaterialTheme.typography.bodyMedium,
						)
					}
					IconButton(onClick = onDismiss) {
						Icon(Icons.Default.Close, contentDescription = "Dismiss")
					}
				}
			}

			is UploadState.Error -> {
				Row(
					modifier = Modifier
						.fillMaxWidth()
						.padding(12.dp),
					verticalAlignment = Alignment.CenterVertically,
					horizontalArrangement = Arrangement.SpaceBetween,
				) {
					Column(modifier = Modifier.weight(1f)) {
						Row(verticalAlignment = Alignment.CenterVertically) {
							Icon(
								imageVector = Icons.Default.Error,
								contentDescription = "Upload error",
								tint = MaterialTheme.colorScheme.error,
							)
							Text(
								text = state.message,
								modifier = Modifier.padding(start = 8.dp),
								style = MaterialTheme.typography.bodyMedium,
							)
						}
						if (state.retryAfterSeconds != null) {
							Text(
								text = "Retry after ${state.retryAfterSeconds}s",
								style = MaterialTheme.typography.bodySmall,
								color = MaterialTheme.colorScheme.onSurfaceVariant,
								modifier = Modifier.padding(start = 32.dp, top = 4.dp),
							)
						}
					}
					IconButton(onClick = onDismiss) {
						Icon(Icons.Default.Close, contentDescription = "Dismiss")
					}
				}
			}

			UploadState.Idle -> Unit
		}
	}
}

private fun phaseLabel(phase: UploadPhase): String {
	return when (phase) {
		UploadPhase.PREPARING -> "Preparing upload"
		UploadPhase.CHUNKS -> "Uploading chunks"
		UploadPhase.TELEGRAM -> "Uploading to Telegram"
		UploadPhase.FINALIZING -> "Finalizing"
	}
}
