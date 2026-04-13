package com.hobbywarehouse.componentdb.network

import android.webkit.CookieManager
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

/** Bridges OkHttp cookies with [CookieManager] so [android.webkit.WebView] login applies to API calls. */
class WebKitCookieJar : CookieJar {
    private val manager: CookieManager = CookieManager.getInstance().apply {
        setAcceptCookie(true)
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        for (cookie in cookies) {
            manager.setCookie(url.toString(), cookie.toString())
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val header = manager.getCookie(url.toString()) ?: return emptyList()
        return header.split(";")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .mapNotNull { segment -> Cookie.parse(url, segment) }
    }
}
