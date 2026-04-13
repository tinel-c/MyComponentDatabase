package com.hobbywarehouse.componentdb.ui

import com.hobbywarehouse.componentdb.data.ErrorBody
import kotlinx.serialization.json.Json
import retrofit2.HttpException

private val errJson =
    Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

fun Throwable.userMessage(fallback: String = "Something went wrong."): String {
    if (this is HttpException) {
        val raw = response()?.errorBody()?.string().orEmpty()
        if (raw.isNotBlank()) {
            runCatching { errJson.decodeFromString<ErrorBody>(raw) }
                .getOrNull()
                ?.error
                ?.takeIf { it.isNotBlank() }
                ?.let { return it }
        }
        return "HTTP ${code()}: ${message()}"
    }
    return message ?: fallback
}
