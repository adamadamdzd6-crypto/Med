package com.example

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    // Keep screen active during gameplay sessions
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    // Hide system bars for complete landscape immersion
    hideSystemBars()

    setContent {
      MyApplicationTheme {
        Box(
          modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0D14))
        ) {
          GameScreen()
        }
      }
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      hideSystemBars()
    }
  }

  private fun hideSystemBars() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.hide(WindowInsetsCompat.Type.systemBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GameScreen() {
  val context = LocalContext.current
  val webView = remember {
    WebView(context).apply {
      layoutParams = android.view.ViewGroup.LayoutParams(
        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
        android.view.ViewGroup.LayoutParams.MATCH_PARENT
      )
      // Use LAYER_TYPE_NONE (default) so WebView renders directly into the window compositor
      // without forcing an offscreen hardware View layer that queries /dev/dri render nodes
      setLayerType(View.LAYER_TYPE_NONE, null)
      setBackgroundColor(android.graphics.Color.parseColor("#0A0D14"))

      settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        databaseEnabled = true
        mediaPlaybackRequiresUserGesture = false
        useWideViewPort = true
        loadWithOverviewMode = true
        setSupportZoom(false)
        displayZoomControls = false
        cacheMode = WebSettings.LOAD_DEFAULT
        allowFileAccess = true
        allowFileAccessFromFileURLs = true
        allowUniversalAccessFromFileURLs = true
      }

      webChromeClient = WebChromeClient()
      webViewClient = object : WebViewClient() {
        override fun onPageFinished(view: WebView?, url: String?) {
          super.onPageFinished(view, url)
        }
      }

      loadUrl("file:///android_asset/game/index.html")
    }
  }

  BackHandler {
    // If modal is open in the game, close it
    webView.evaluateJavascript(
      "if (document.getElementById('weapon-modal') && !document.getElementById('weapon-modal').classList.contains('hidden')) { window.game.closeWeaponModal(); } else if (document.getElementById('weather-modal') && !document.getElementById('weather-modal').classList.contains('hidden')) { window.game.closeWeatherModal(); } else if (document.getElementById('bestiary-modal') && !document.getElementById('bestiary-modal').classList.contains('hidden')) { window.game.closeBestiaryModal(); } else if (document.getElementById('settings-modal') && !document.getElementById('settings-modal').classList.contains('hidden')) { document.getElementById('settings-modal').classList.add('hidden'); } else if (document.getElementById('files-modal') && !document.getElementById('files-modal').classList.contains('hidden')) { document.getElementById('files-modal').classList.add('hidden'); }"
    ) {}
  }

  DisposableEffect(Unit) {
    onDispose {
      webView.destroy()
    }
  }

  AndroidView(
    factory = { webView },
    modifier = Modifier.fillMaxSize()
  )
}
