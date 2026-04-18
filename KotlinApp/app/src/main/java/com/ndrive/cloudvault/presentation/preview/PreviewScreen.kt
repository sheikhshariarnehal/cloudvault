package com.ndrive.cloudvault.presentation.preview

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PreviewScreen(
	navController: NavController,
	fileId: String,
	viewModel: PreviewViewModel = hiltViewModel(),
) {
	val context = LocalContext.current
	val uiState by viewModel.uiState.collectAsState()
	val errorMessage = uiState.errorMessage

	LaunchedEffect(fileId) {
		viewModel.preparePreview(fileId)
	}

	LaunchedEffect(uiState.openUri, uiState.isOpening) {
		if (!uiState.isOpening) return@LaunchedEffect
		val targetUri = uiState.openUri ?: return@LaunchedEffect

		openWithDefaultApp(
			context = context,
			fileUri = targetUri,
			mimeType = uiState.mimeType,
			fileName = uiState.fileName,
			onOpened = { viewModel.onOpenHandled() },
			onFailure = { message -> viewModel.onOpenFailed(message) },
		)
	}

	Scaffold(
		topBar = {
			TopAppBar(
				title = {
					Text(
						text = if (uiState.fileName.isBlank()) "File preview" else uiState.fileName,
						maxLines = 1,
					)
				},
				navigationIcon = {
					TextButton(onClick = { navController.popBackStack() }) {
						Text("Back")
					}
				},
			)
		},
	) { paddingValues ->
		Column(
			modifier = Modifier
				.fillMaxSize()
				.padding(paddingValues)
				.padding(horizontal = 24.dp, vertical = 16.dp),
			horizontalAlignment = Alignment.CenterHorizontally,
			verticalArrangement = Arrangement.Center,
		) {
			when {
				uiState.isLoading -> {
					CircularProgressIndicator()
					Spacer(modifier = Modifier.height(16.dp))
					Text(
						text = uiState.statusMessage ?: "Preparing preview...",
						textAlign = TextAlign.Center,
						style = MaterialTheme.typography.bodyMedium,
					)
				}

				errorMessage != null -> {
					Text(
						text = "Could not open this file",
						style = MaterialTheme.typography.titleMedium,
						fontWeight = FontWeight.SemiBold,
						textAlign = TextAlign.Center,
					)
					Spacer(modifier = Modifier.height(8.dp))
					Text(
						text = errorMessage,
						style = MaterialTheme.typography.bodyMedium,
						color = MaterialTheme.colorScheme.error,
						textAlign = TextAlign.Center,
					)
					Spacer(modifier = Modifier.height(20.dp))
					Button(
						onClick = { viewModel.retry() },
						modifier = Modifier.fillMaxWidth(),
					) {
						Text("Retry")
					}
				}

				uiState.isReady -> {
					Text(
						text = uiState.statusMessage ?: "Ready to open with your device app.",
						style = MaterialTheme.typography.bodyMedium,
						textAlign = TextAlign.Center,
					)
					Spacer(modifier = Modifier.height(20.dp))
					Button(
						onClick = { viewModel.requestOpenAgain() },
						modifier = Modifier.fillMaxWidth(),
					) {
						Text("Open with default app")
					}
				}

				else -> {
					Text(
						text = "Preparing preview...",
						style = MaterialTheme.typography.bodyMedium,
						textAlign = TextAlign.Center,
					)
				}
			}
		}
	}
}

private fun openWithDefaultApp(
	context: Context,
	fileUri: Uri,
	mimeType: String,
	fileName: String,
	onOpened: () -> Unit,
	onFailure: (String) -> Unit,
) {
	val hasActivityContext = context.findActivity() != null
	val normalizedMime = normalizeMimeType(mimeType)
	val guessedMime = guessMimeTypeFromName(fileName)
	val candidateMimes = listOf(normalizedMime, guessedMime, "*/*")
		.filterNotNull()
		.filter { it.isNotBlank() }
		.distinct()

	var lastError: Throwable? = null
	val packageManager = context.packageManager

	for (candidateMime in candidateMimes) {
		val viewIntent = Intent(Intent.ACTION_VIEW).apply {
			setDataAndType(fileUri, candidateMime)
			clipData = ClipData.newUri(context.contentResolver, fileName, fileUri)
			addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
			if (!hasActivityContext) {
				addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
			}
		}

		val handlers = packageManager.queryIntentActivities(
			viewIntent,
			PackageManager.MATCH_DEFAULT_ONLY,
		)

		if (handlers.isEmpty() && candidateMime != "*/*") {
			continue
		}

		handlers.forEach { resolveInfo ->
			runCatching {
				context.grantUriPermission(
					resolveInfo.activityInfo.packageName,
					fileUri,
					Intent.FLAG_GRANT_READ_URI_PERMISSION,
				)
			}
		}

		val chooser = Intent.createChooser(viewIntent, "Open with").apply {
			addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
			if (!hasActivityContext) {
				addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
			}
		}

		val launched = runCatching {
			ContextCompat.startActivity(context, chooser, null)
		}.onFailure { error ->
			lastError = error
		}.isSuccess

		if (launched) {
			onOpened()
			return
		}
	}

	val message = when (val error = lastError) {
		is ActivityNotFoundException -> "No compatible app found on this device."
		is SecurityException -> "Permission denied while opening this file."
		null -> "No compatible app found on this device."
		else -> error.message?.takeIf { it.isNotBlank() } ?: "Unable to open this file."
	}
	onFailure(message)
}

private fun normalizeMimeType(rawMime: String?): String? {
	if (rawMime.isNullOrBlank()) return null
	val cleaned = rawMime.substringBefore(';').trim().lowercase()
	if (cleaned.isBlank()) return null
	if (cleaned == "application/octet-stream" || cleaned == "binary/octet-stream") return null
	return cleaned
}

private fun guessMimeTypeFromName(fileName: String): String? {
	val extension = fileName.substringAfterLast('.', "").trim().lowercase()
	if (extension.isBlank()) return null
	return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
}

private tailrec fun Context.findActivity(): Activity? {
	return when (this) {
		is Activity -> this
		is android.content.ContextWrapper -> baseContext.findActivity()
		else -> null
	}
}
