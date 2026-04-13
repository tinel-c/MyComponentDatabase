package com.hobbywarehouse.componentdb.ui.screens

import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.hobbywarehouse.componentdb.network.ApiFactory
import com.hobbywarehouse.componentdb.ui.userMessage
import java.io.File
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaptureRoute(
    partId: String,
    baseUrl: String,
    onDone: () -> Unit,
    onBack: () -> Unit,
) {
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mainExecutor = remember { ContextCompat.getMainExecutor(context) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val imageCapture = remember { ImageCapture.Builder().build() }
    val previewView = remember { PreviewView(context) }

    DisposableEffect(lifecycleOwner) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        val runnable =
            Runnable {
                val cameraProvider = cameraProviderFuture.get()
                val preview =
                    Preview.Builder()
                        .build()
                        .also { it.setSurfaceProvider(previewView.surfaceProvider) }
                try {
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageCapture,
                    )
                } catch (e: Exception) {
                    mainExecutor.execute {
                        scope.launch {
                            snackbar.showSnackbar(e.userMessage("Could not start camera."))
                        }
                    }
                }
            }
        cameraProviderFuture.addListener(runnable, mainExecutor)
        onDispose {
            cameraProviderFuture.addListener(
                {
                    runCatching {
                        cameraProviderFuture.get().unbindAll()
                    }
                },
                mainExecutor,
            )
            cameraExecutor.shutdown()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Add photo") },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Cancel")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding),
        ) {
            AndroidView(
                factory = { previewView },
                modifier = Modifier.fillMaxSize(),
            )
            Button(
                onClick = {
                    val file = File(context.cacheDir, "upload-${System.currentTimeMillis()}.jpg")
                    val opts = ImageCapture.OutputFileOptions.Builder(file).build()
                    imageCapture.takePicture(
                        opts,
                        cameraExecutor,
                        object : ImageCapture.OnImageSavedCallback {
                            override fun onImageSaved(_output: ImageCapture.OutputFileResults) {
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        val body =
                                            file.asRequestBody("image/jpeg".toMediaType())
                                        val part =
                                            MultipartBody.Part.createFormData(
                                                "files",
                                                file.name,
                                                body,
                                            )
                                        val api = ApiFactory.createMobileApi(baseUrl)
                                        api.uploadImages(partId, listOf(part))
                                        withContext(Dispatchers.Main) {
                                            onDone()
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) {
                                            snackbar.showSnackbar(e.userMessage())
                                        }
                                    }
                                }
                            }

                            override fun onError(exception: ImageCaptureException) {
                                scope.launch {
                                    snackbar.showSnackbar(exception.userMessage("Capture failed."))
                                }
                            }
                        },
                    )
                },
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(24.dp),
            ) {
                Text("Capture & upload")
            }
        }
    }
}
