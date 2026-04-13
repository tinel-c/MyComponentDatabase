package com.hobbywarehouse.componentdb.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.hobbywarehouse.componentdb.data.MobilePart
import com.hobbywarehouse.componentdb.data.PatchQuantityBody
import com.hobbywarehouse.componentdb.network.ApiFactory
import com.hobbywarehouse.componentdb.ui.userMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PartDetailRoute(
    partId: String,
    baseUrl: String,
    onOpenCapture: () -> Unit,
    onBack: () -> Unit,
) {
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var part by remember { mutableStateOf<MobilePart?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var quantityText by remember { mutableStateOf("") }

    LaunchedEffect(partId, baseUrl) {
        loading = true
        error = null
        try {
            val p =
                withContext(Dispatchers.IO) {
                    val api = ApiFactory.createMobileApi(baseUrl)
                    api.part(partId).part
                }
            part = p
            quantityText = p.quantityOnHand.toString()
        } catch (e: Exception) {
            error = e.userMessage()
        } finally {
            loading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Part") },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            if (part != null) {
                FloatingActionButton(onClick = onOpenCapture) {
                    Icon(Icons.Default.CameraAlt, contentDescription = "Add photo")
                }
            }
        },
    ) { padding ->
        when {
            loading -> {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(padding),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator()
                }
            }

            error != null -> {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(padding)
                            .padding(16.dp),
                ) {
                    Text(text = error ?: "Error", style = MaterialTheme.typography.bodyLarge)
                }
            }

            part != null -> {
                val p = part!!
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(padding)
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                ) {
                    Text(text = p.name, style = MaterialTheme.typography.headlineSmall)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Part #${p.partNumber}",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = quantityText,
                        onValueChange = { quantityText = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Quantity on hand (${p.unit})") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            val q = quantityText.toIntOrNull()
                            if (q == null) {
                                scope.launch { snackbar.showSnackbar("Enter a valid quantity.") }
                                return@Button
                            }
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val api = ApiFactory.createMobileApi(baseUrl)
                                    val updated = api.patchPart(p.id, PatchQuantityBody(q)).part
                                    withContext(Dispatchers.Main) {
                                        part = updated
                                        quantityText = updated.quantityOnHand.toString()
                                        snackbar.showSnackbar("Saved.")
                                    }
                                } catch (e: Exception) {
                                    withContext(Dispatchers.Main) {
                                        snackbar.showSnackbar(e.userMessage())
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Save quantity")
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Images",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    val hero = p.imageUrl
                    if (hero != null) {
                        AsyncImage(
                            model = hero,
                            contentDescription = "Hero image",
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .height(220.dp),
                            contentScale = ContentScale.Fit,
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(vertical = 4.dp),
                    ) {
                        items(p.images, key = { it.id }) { img ->
                            AsyncImage(
                                model = img.url,
                                contentDescription = img.caption ?: "Part image",
                                modifier =
                                    Modifier
                                        .height(120.dp)
                                        .width(160.dp),
                                contentScale = ContentScale.Crop,
                            )
                        }
                    }
                }
            }
        }
    }
}
