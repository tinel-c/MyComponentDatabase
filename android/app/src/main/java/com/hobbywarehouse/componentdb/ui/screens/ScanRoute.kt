package com.hobbywarehouse.componentdb.ui.screens

import android.Manifest
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.hobbywarehouse.componentdb.network.ApiFactory
import com.hobbywarehouse.componentdb.ui.userMessage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun ScanRoute(
    baseUrl: String,
    onPartFound: (partId: String) -> Unit,
    onBack: () -> Unit,
) {
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)

    LaunchedEffect(Unit) {
        if (!cameraPermission.status.isGranted) {
            cameraPermission.launchPermissionRequest()
        }
    }

    val scanned = remember { AtomicBoolean(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scan part number") },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        if (!cameraPermission.status.isGranted) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(16.dp),
            ) {
                Text("Camera permission is required to scan QR codes.")
                Spacer(modifier = Modifier.padding(8.dp))
                Button(onClick = { cameraPermission.launchPermissionRequest() }) {
                    Text("Grant permission")
                }
            }
            return@Scaffold
        }

        val executor: ExecutorService = remember { Executors.newSingleThreadExecutor() }
        val barcodeClient = remember { BarcodeScanning.getClient() }
        val previewView = remember { PreviewView(context) }

        DisposableEffect(lifecycleOwner, baseUrl) {
            val mainExecutor = ContextCompat.getMainExecutor(context)
            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
            val cameraRunnable =
                Runnable {
                    val cameraProvider = cameraProviderFuture.get()
                    val preview =
                        Preview.Builder()
                            .build()
                            .also { it.setSurfaceProvider(previewView.surfaceProvider) }
                    val analysis =
                        ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()
                    analysis.setAnalyzer(executor) { imageProxy: ImageProxy ->
                        processBarcodeFrame(
                            imageProxy = imageProxy,
                            scanned = scanned,
                            barcodeClient = barcodeClient,
                            scope = scope,
                            snackbar = snackbar,
                            baseUrl = baseUrl,
                            onPartFound = onPartFound,
                        )
                    }
                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview,
                            analysis,
                        )
                    } catch (e: Exception) {
                        mainExecutor.execute {
                            scope.launch {
                                snackbar.showSnackbar(e.userMessage("Could not start camera."))
                            }
                        }
                    }
                }
            cameraProviderFuture.addListener(cameraRunnable, mainExecutor)

            onDispose {
                scanned.set(false)
                executor.shutdown()
                cameraProviderFuture.addListener(
                    {
                        runCatching {
                            cameraProviderFuture.get().unbindAll()
                        }
                    },
                    mainExecutor,
                )
            }
        }

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
            Text(
                text = "Point the camera at a QR code with the part number (digits only).",
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .fillMaxWidth()
                        .padding(16.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private fun processBarcodeFrame(
    imageProxy: ImageProxy,
    scanned: AtomicBoolean,
    barcodeClient: BarcodeScanner,
    scope: kotlinx.coroutines.CoroutineScope,
    snackbar: SnackbarHostState,
    baseUrl: String,
    onPartFound: (partId: String) -> Unit,
) {
    if (scanned.get()) {
        imageProxy.close()
        return
    }
    val mediaImage = imageProxy.image
    if (mediaImage == null) {
        imageProxy.close()
        return
    }
    val image =
        InputImage.fromMediaImage(
            mediaImage,
            imageProxy.imageInfo.rotationDegrees,
        )
    barcodeClient
        .process(image)
        .addOnSuccessListener { barcodes ->
            if (scanned.get()) return@addOnSuccessListener
            val raw =
                barcodes
                    .firstOrNull { !it.rawValue.isNullOrBlank() }
                    ?.rawValue
                    ?.trim()
                    .orEmpty()
            if (raw.isEmpty()) return@addOnSuccessListener
            if (!raw.all { it.isDigit() }) {
                scope.launch {
                    snackbar.showSnackbar("QR must contain digits only (part number).")
                }
                return@addOnSuccessListener
            }
            if (!scanned.compareAndSet(false, true)) return@addOnSuccessListener
            scope.launch(Dispatchers.IO) {
                try {
                    val api = ApiFactory.createMobileApi(baseUrl)
                    val part = api.partByNumber(raw).part
                    withContext(Dispatchers.Main) {
                        onPartFound(part.id)
                    }
                } catch (e: Exception) {
                    scanned.set(false)
                    withContext(Dispatchers.Main) {
                        snackbar.showSnackbar(e.userMessage())
                    }
                }
            }
        }
        .addOnFailureListener { e ->
            scope.launch {
                snackbar.showSnackbar(e.userMessage())
            }
        }
        .addOnCompleteListener {
            imageProxy.close()
        }
}
