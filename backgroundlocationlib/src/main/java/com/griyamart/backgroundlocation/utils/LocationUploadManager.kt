package com.griyamart.backgroundlocation.utils

import android.util.Log
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.gson.Gson
import com.griyamart.backgroundlocation.config.BackgroundLocationConfig
import com.griyamart.backgroundlocation.config.HttpMethod
import com.griyamart.backgroundlocation.model.LocationBatch
import com.griyamart.backgroundlocation.model.LocationData
import com.griyamart.backgroundlocation.model.LocationResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Url
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit

/**
 * Manages uploading location data to remote servers and Firebase
 */
class LocationUploadManager(
    private var config: BackgroundLocationConfig,
    private val scope: CoroutineScope
) {
    companion object {
        private const val TAG = "LocationUploadManager"
    }

    private val gson = Gson()
    private val locationQueue = ConcurrentLinkedQueue<LocationData>()
    private var uploadJob: Job? = null
    private var isUploading = false

    // Network components
    private var retrofit: Retrofit? = null
    private var apiService: LocationApiService? = null
    private var okHttpClient: OkHttpClient? = null

    // Firebase components
    private var firebaseDatabase: FirebaseDatabase? = null
    private var locationRef: DatabaseReference? = null

    init {
        initializeNetworkComponents()
        initializeFirebase()
        startPeriodicUpload()
    }

    fun updateConfig(newConfig: BackgroundLocationConfig) {
        config = newConfig
        initializeNetworkComponents()
        initializeFirebase()
    }

    fun queueLocation(locationData: LocationData) {
        locationQueue.offer(locationData)

        // If batching is disabled, upload immediately
        config.networkConfig?.enableBatching?.let {
            if (!it) {
                scope.launch {
                    uploadSingleLocation(locationData)
                }
            }
        }
    }

    fun uploadPendingLocations() {
        scope.launch {
            uploadQueuedLocations()
        }
    }

    private fun initializeNetworkComponents() {
        try {
            config.networkConfig?.let {
                // Create OkHttp client with timeouts and interceptors
                okHttpClient = OkHttpClient.Builder()
                    .connectTimeout(it.timeoutMs, TimeUnit.MILLISECONDS)
                    .readTimeout(it.timeoutMs, TimeUnit.MILLISECONDS)
                    .writeTimeout(it.timeoutMs, TimeUnit.MILLISECONDS)
                    .addInterceptor(createHeaderInterceptor())
                    .addInterceptor(createLoggingInterceptor())
                    .build()

                // Create Retrofit instance
                retrofit = Retrofit.Builder()
                    .baseUrl(it.baseUrl)
                    .client(okHttpClient!!)
                    .addConverterFactory(GsonConverterFactory.create(gson))
                    .build()

                apiService = retrofit!!.create(LocationApiService::class.java)

                log("Network components initialized for ${it.baseUrl}")
            }

        } catch (e: Exception) {
            log("Failed to initialize network components: ${e.message}")
        }
    }

    private fun createHeaderInterceptor(): Interceptor {
        return Interceptor { chain ->
            val originalRequest = chain.request()
            val builder = originalRequest.newBuilder()

            // Add configured headers
            config.networkConfig?.headers?.forEach { (key, value) ->
                builder.addHeader(key, value)
            }

            // Add content type for JSON
            builder.addHeader("Content-Type", "application/json")

            chain.proceed(builder.build())
        }
    }

    private fun createLoggingInterceptor(): Interceptor {
        return Interceptor { chain ->
            val request = chain.request()
            val startTime = System.currentTimeMillis()

            try {
                val response = chain.proceed(request)
                val endTime = System.currentTimeMillis()

                if (config.enableDebugLogging) {
                    log("HTTP ${response.code} ${request.method} ${request.url} (${endTime - startTime}ms)")
                }

                response
            } catch (e: Exception) {
                val endTime = System.currentTimeMillis()
                log("HTTP Error ${request.method} ${request.url} (${endTime - startTime}ms): ${e.message}")
                throw e
            }
        }
    }

    private fun initializeFirebase() {
        if (config.firebaseConfig.enabled) {
            try {
                firebaseDatabase = config.firebaseConfig.databaseUrl?.let { url ->
                    FirebaseDatabase.getInstance(url)
                } ?: FirebaseDatabase.getInstance()

                val path = config.firebaseConfig.userIdPath?.let { userPath ->
                    // Replace {userId} with actual user ID
                    userPath.replace("{userId}", config.payloadConfig.userId ?: "unknown")
                } ?: "${config.firebaseConfig.rootPath}/${config.payloadConfig.userId ?: "default"}"

                locationRef = firebaseDatabase?.getReference(path)

                log("Firebase initialized with path: $path")
            } catch (e: Exception) {
                log("Failed to initialize Firebase: ${e.message}")
            }
        }
    }

    private fun startPeriodicUpload() {
        if (config.networkConfig?.enableBatching == true) {
            uploadJob = scope.launch {
                while (isActive) {
                    delay(30000) // Upload every 30 seconds
                    uploadQueuedLocations()
                }
            }
        }
    }

    private suspend fun uploadSingleLocation(locationData: LocationData) {
        if (isUploading) return

        try {
            isUploading = true

            // Upload to Firebase if enabled
            uploadToFirebase(locationData)

            // Upload to API
            uploadToApi(locationData)

        } catch (e: Exception) {
            log("Error uploading single location: ${e.message}")
            // Re-queue for retry
            locationQueue.offer(locationData)
        } finally {
            isUploading = false
        }
    }

    private suspend fun uploadQueuedLocations() {
        if (locationQueue.isEmpty() || isUploading) return

        try {
            isUploading = true

            val locations = mutableListOf<LocationData>()
            val batchSize: Int = config.networkConfig?.batchSize ?: 50

            // Drain queue up to batch size
            repeat(minOf(batchSize, locationQueue.size)) {
                locationQueue.poll()?.let { locations.add(it) }
            }

            if (locations.isNotEmpty()) {
                val batch = LocationBatch(
                    locations = locations,
                    batchId = UUID.randomUUID().toString(),
                    deviceId = config.payloadConfig.deviceId,
                    userId = config.payloadConfig.userId
                )

                // Upload to Firebase if enabled
                uploadBatchToFirebase(batch)

                // Upload to API
                uploadBatchToApi(batch)

                log("Uploaded batch of ${locations.size} locations")
            }

        } catch (e: Exception) {
            log("Error uploading queued locations: ${e.message}")
        } finally {
            isUploading = false
        }
    }

    private suspend fun uploadToFirebase(locationData: LocationData) {
        if (!config.firebaseConfig.enabled || locationRef == null) return

        try {
            withContext(Dispatchers.IO) {
                if (config.firebaseConfig.enableRealtimeUpdates) {
                    // Update current location
                    locationRef!!.child("current").setValue(locationData)
                }

                // Add to history with timestamp key
                locationRef!!.child("history")
                    .child(locationData.timestamp.toString())
                    .setValue(locationData)
            }

            log("Location uploaded to Firebase")
        } catch (e: Exception) {
            log("Failed to upload to Firebase: ${e.message}")
            throw e
        }
    }

    private suspend fun uploadBatchToFirebase(batch: LocationBatch) {
        if (!config.firebaseConfig.enabled || locationRef == null) return

        try {
            withContext(Dispatchers.IO) {
                val updates = mutableMapOf<String, Any>()

                batch.locations.forEach { location ->
                    updates["history/${location.timestamp}"] = location
                }

                // Update current location to latest in batch
                batch.locations.lastOrNull()?.let { lastLocation ->
                    if (config.firebaseConfig.enableRealtimeUpdates) {
                        updates["current"] = lastLocation
                    }
                }

                locationRef!!.updateChildren(updates)
            }

            log("Location batch uploaded to Firebase")
        } catch (e: Exception) {
            log("Failed to upload batch to Firebase: ${e.message}")
            throw e
        }
    }

    private suspend fun uploadToApi(locationData: LocationData) {
        config.networkConfig?.let {
            uploadToApiWithRetry {
                when (it.method) {
                    HttpMethod.POST -> apiService!!.uploadLocationPost(it.endpoint, locationData)
                    HttpMethod.PUT -> apiService!!.uploadLocationPut(it.endpoint, locationData)
                    HttpMethod.PATCH -> apiService!!.uploadLocationPatch(it.endpoint, locationData)
                }
            }
        }

    }

    private suspend fun uploadBatchToApi(batch: LocationBatch) {
        config.networkConfig?.let {
            uploadToApiWithRetry {
                when (it.method) {
                    HttpMethod.POST -> apiService!!.uploadBatchPost(it.endpoint, batch)
                    HttpMethod.PUT -> apiService!!.uploadBatchPut(it.endpoint, batch)
                    HttpMethod.PATCH -> apiService!!.uploadBatchPatch(it.endpoint, batch)
                }
            }
        }

    }

    private suspend fun <T> uploadToApiWithRetry(apiCall: suspend () -> Response<T>) {
        val networkConfig = config.networkConfig
        var attempt = 0
        var lastException: Exception? = null

        while (attempt <= (networkConfig?.retryCount ?: 0)) {
            try {
                val response = apiCall()

                if (response.isSuccessful) {
                    log("API upload successful: ${response.code()}")
                    return
                } else {
                    log("API upload failed: ${response.code()} - ${response.message()}")
                    throw Exception("HTTP ${response.code()}: ${response.message()}")
                }

            } catch (e: Exception) {
                lastException = e
                attempt++

                if (attempt <= (networkConfig?.retryCount ?: 0)) {
                    log("API upload attempt $attempt failed, retrying in ${networkConfig?.retryDelayMs}ms: ${e.message}")
                    delay(networkConfig?.retryDelayMs?.toLong() ?: 5000L)
                } else {
                    log("API upload failed after ${networkConfig?.retryCount} retries: ${e.message}")
                }
            }
        }

        // All retries failed
        lastException?.let { throw it }
    }

    private fun log(message: String) {
        if (config.enableDebugLogging) {
            Log.d(TAG, message)
        }
    }

    fun cleanup() {
        uploadJob?.cancel()
    }
}

/**
 * Retrofit API service interface supporting multiple HTTP methods
 */
interface LocationApiService {
    @POST
    suspend fun uploadLocationPost(
        @Url url: String,
        @Body locationData: LocationData
    ): Response<LocationResponse>

    @PUT
    suspend fun uploadLocationPut(
        @Url url: String,
        @Body locationData: LocationData
    ): Response<LocationResponse>

    @PATCH
    suspend fun uploadLocationPatch(
        @Url url: String,
        @Body locationData: LocationData
    ): Response<LocationResponse>

    @POST
    suspend fun uploadBatchPost(
        @Url url: String,
        @Body batch: LocationBatch
    ): Response<LocationResponse>

    @PUT
    suspend fun uploadBatchPut(
        @Url url: String,
        @Body batch: LocationBatch
    ): Response<LocationResponse>

    @PATCH
    suspend fun uploadBatchPatch(
        @Url url: String,
        @Body batch: LocationBatch
    ): Response<LocationResponse>
}
