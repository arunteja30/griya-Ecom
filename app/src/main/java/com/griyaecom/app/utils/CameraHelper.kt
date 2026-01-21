package com.griyaecom.app.utils

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.griyaecom.app.MainActivity
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class CameraHelper(private val activity: MainActivity) {
    
    private var currentPhotoPath: String? = null
    private var photoCallback: ((Uri?, String?) -> Unit)? = null
    private var galleryCallback: ((Uri?, String?) -> Unit)? = null
    
    private lateinit var cameraLauncher: ActivityResultLauncher<Intent>
    private lateinit var galleryLauncher: ActivityResultLauncher<Intent>

    companion object {
        val CAMERA_PERMISSIONS = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        )
        
        private const val JPEG_FILE_PREFIX = "IMG_"
        private const val JPEG_FILE_SUFFIX = ".jpg"
    }

    init {
        setupActivityLaunchers()
    }

    private fun setupActivityLaunchers() {
        cameraLauncher = activity.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            handleCameraResult(result.resultCode, result.data)
        }
        
        galleryLauncher = activity.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            handleGalleryResult(result.resultCode, result.data)
        }
    }

    fun hasCameraPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ doesn't need WRITE_EXTERNAL_STORAGE
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            CAMERA_PERMISSIONS.all { permission ->
                ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
            }
        }
    }

    fun requestCameraPermission() {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.CAMERA)
        } else {
            CAMERA_PERMISSIONS
        }
        activity.requestPermissions(permissions)
    }

    fun capturePhoto(callback: (Uri?, String?) -> Unit) {
        photoCallback = callback
        
        if (!hasCameraPermission()) {
            callback(null, "Camera permission not granted")
            return
        }

        try {
            val photoFile = createImageFile()
            val photoUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                photoFile
            )

            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                flags = Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            }

            if (intent.resolveActivity(activity.packageManager) != null) {
                cameraLauncher.launch(intent)
            } else {
                callback(null, "No camera app available")
            }

        } catch (e: IOException) {
            callback(null, "Error creating image file: ${e.message}")
        } catch (e: Exception) {
            callback(null, "Camera error: ${e.message}")
        }
    }

    fun selectFromGallery(callback: (Uri?, String?) -> Unit) {
        galleryCallback = callback
        
        try {
            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
                type = "image/*"
            }

            if (intent.resolveActivity(activity.packageManager) != null) {
                galleryLauncher.launch(intent)
            } else {
                callback(null, "No gallery app available")
            }

        } catch (e: Exception) {
            callback(null, "Gallery error: ${e.message}")
        }
    }

    private fun handleCameraResult(resultCode: Int, data: Intent?) {
        val callback = photoCallback ?: return
        photoCallback = null
        
        if (resultCode == android.app.Activity.RESULT_OK) {
            currentPhotoPath?.let { path ->
                val file = File(path)
                if (file.exists()) {
                    val uri = Uri.fromFile(file)
                    
                    // Add to gallery
                    galleryAddPic(file)
                    
                    callback(uri, null)
                } else {
                    callback(null, "Photo file not found")
                }
            } ?: callback(null, "Photo path is null")
        } else {
            callback(null, "Photo capture cancelled")
        }
    }

    private fun handleGalleryResult(resultCode: Int, data: Intent?) {
        val callback = galleryCallback ?: return
        galleryCallback = null
        
        if (resultCode == android.app.Activity.RESULT_OK) {
            data?.data?.let { uri ->
                callback(uri, null)
            } ?: callback(null, "No image selected")
        } else {
            callback(null, "Gallery selection cancelled")
        }
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = JPEG_FILE_PREFIX + timeStamp + "_"
        
        val storageDir = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Use app-specific directory for Android 10+
            File(activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "GriyaMart")
        } else {
            // Use public directory for older versions
            File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "GriyaMart")
        }
        
        // Create directory if it doesn't exist
        if (!storageDir.exists()) {
            storageDir.mkdirs()
        }
        
        val image = File.createTempFile(
            imageFileName,
            JPEG_FILE_SUFFIX,
            storageDir
        )
        
        currentPhotoPath = image.absolutePath
        return image
    }

    private fun galleryAddPic(file: File) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Use MediaStore API for Android 10+
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, file.name)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                    put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/GriyaMart")
                }
                
                val resolver = activity.contentResolver
                val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                
                uri?.let {
                    resolver.openOutputStream(it)?.use { outputStream ->
                        file.inputStream().use { inputStream ->
                            inputStream.copyTo(outputStream)
                        }
                    }
                }
            } else {
                // Use MediaScannerConnection for older versions
                val intent = Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE)
                intent.data = Uri.fromFile(file)
                activity.sendBroadcast(intent)
            }
        } catch (e: Exception) {
            // Log but don't fail if gallery addition fails
            e.printStackTrace()
        }
    }

    fun getImagePath(uri: Uri): String? {
        return try {
            when (uri.scheme) {
                "file" -> uri.path
                "content" -> getRealPathFromURI(uri)
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun getRealPathFromURI(uri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            val projection = arrayOf(MediaStore.Images.Media.DATA)
            cursor = activity.contentResolver.query(uri, projection, null, null, null)
            cursor?.let {
                val columnIndex = it.getColumnIndexOrThrow(MediaStore.Images.Media.DATA)
                it.moveToFirst()
                it.getString(columnIndex)
            }
        } catch (e: Exception) {
            null
        } finally {
            cursor?.close()
        }
    }

    fun getMimeType(uri: Uri): String? {
        return when (uri.scheme) {
            "content" -> activity.contentResolver.getType(uri)
            "file" -> {
                val extension = MimeTypeMap.getFileExtensionFromUrl(uri.path)
                MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
            }
            else -> null
        }
    }

    fun getFileSize(uri: Uri): Long {
        return try {
            when (uri.scheme) {
                "content" -> {
                    activity.contentResolver.openInputStream(uri)?.use { inputStream ->
                        inputStream.available().toLong()
                    } ?: 0L
                }
                "file" -> {
                    val file = File(uri.path!!)
                    if (file.exists()) file.length() else 0L
                }
                else -> 0L
            }
        } catch (e: Exception) {
            0L
        }
    }

    fun isImageFile(uri: Uri): Boolean {
        val mimeType = getMimeType(uri)
        return mimeType?.startsWith("image/") == true
    }

    // Convert image to base64 string (useful for web interface)
    fun convertToBase64(uri: Uri): String? {
        return try {
            activity.contentResolver.openInputStream(uri)?.use { inputStream ->
                val bytes = inputStream.readBytes()
                android.util.Base64.encodeToString(bytes, android.util.Base64.DEFAULT)
            }
        } catch (e: Exception) {
            null
        }
    }
}