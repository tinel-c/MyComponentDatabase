package com.hobbywarehouse.componentdb.network

import com.hobbywarehouse.componentdb.BuildConfig
import com.hobbywarehouse.componentdb.data.MobileApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

object ApiFactory {
    private val json =
        Json {
            ignoreUnknownKeys = true
            isLenient = true
        }

    private val logging =
        HttpLoggingInterceptor().apply {
            level =
                if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BODY
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
        }

    val okHttp: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .cookieJar(WebKitCookieJar())
            .addInterceptor(logging)
            .build()
    }

    fun createMobileApi(baseUrl: String): MobileApi {
        val normalized = baseUrl.trim().let { if (it.endsWith("/")) it else "$it/" }
        return Retrofit.Builder()
            .baseUrl(normalized)
            .client(okHttp)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(MobileApi::class.java)
    }
}
