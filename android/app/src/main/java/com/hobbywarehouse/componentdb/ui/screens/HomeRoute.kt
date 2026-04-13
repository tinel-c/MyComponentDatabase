package com.hobbywarehouse.componentdb.ui.screens

import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.hobbywarehouse.componentdb.network.ApiFactory
import com.hobbywarehouse.componentdb.ui.userMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeRoute(
    baseUrl: String,
    onBaseUrlChange: (String) -> Unit,
    onSaveBaseUrl: () -> Unit,
    onOpenScan: () -> Unit,
) {
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Hobby Warehouse") },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
        ) {
            Text(
                text = "Site base URL (no trailing path)",
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = baseUrl,
                onValueChange = onBaseUrlChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onSaveBaseUrl,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Save base URL")
            }
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = {
                    scope.launch(Dispatchers.IO) {
                        try {
                            val api = ApiFactory.createMobileApi(baseUrl)
                            val s = api.session()
                            withContext(Dispatchers.Main) {
                                if (s.ok && s.user != null) {
                                    snackbar.showSnackbar("Signed in as ${s.user.email ?: s.user.id}")
                                } else {
                                    snackbar.showSnackbar("Not signed in — use the web login below.")
                                }
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
                Text("Check session")
            }
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onOpenScan,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Scan part QR")
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Sign in with Google (or local dev login) in the web view. Cookies are shared with API calls.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(modifier = Modifier.height(8.dp))
            val loginUrl = remember(baseUrl) { "${baseUrl.trim().trimEnd('/')}/login" }
            key(baseUrl) {
                AndroidView(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f),
                    factory = {
                        WebView(context).apply {
                            CookieManager.getInstance().setAcceptCookie(true)
                            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            webChromeClient = WebChromeClient()
                            webViewClient = WebViewClient()
                            loadUrl(loginUrl)
                        }
                    },
                )
            }
        }
    }
}
